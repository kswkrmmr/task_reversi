// ゲーム・タスクのデータ操作。すべての関数は第1引数の userId で所有者を絞り込み、
// 他ユーザーのタスク・ゲームを読み書きできないようにする。
// 呼び出し側（Server Action / ページ）は requireUserId() で得た値だけを渡すこと。
import { db } from "@/prisma/db";
import { isUniqueViolation } from "@/lib/dbError";
import {
  applyMove,
  isFull,
  replay,
  type Board,
  type Move,
  type Position,
} from "@/lib/reversi/board";
import {
  canUndo,
  checkCanJudge,
  getJstTodayString,
  stoneColorFor,
  summarizeGame,
  type AttemptResult,
  type GameStatus,
  type GameSummary,
  type RecurrenceType,
} from "./rules";

// 利用者に表示してよいメッセージを持つエラー。
export class GameError extends Error {}

const CONFLICT_MESSAGE = "他の操作と重なりました。画面を再読み込みしてやり直してください";

// ---------- タスク ----------

export type TaskInput = { title: string; recurrenceType: RecurrenceType };

export function validateTaskInput(title: unknown, recurrenceType: unknown): TaskInput {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (trimmed.length === 0) throw new GameError("タスク名を入力してください");
  if (trimmed.length > 100) throw new GameError("タスク名は100文字以内にしてください");
  if (recurrenceType !== "once" && recurrenceType !== "daily") {
    throw new GameError("単発か繰り返しかを選んでください");
  }
  return { title: trimmed, recurrenceType };
}

export async function createTask(userId: string, input: TaskInput) {
  return db.orm.public.Task.create({ userId, ...input });
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: TaskInput & { active: boolean },
) {
  const count = await db.orm.public.Task.where({ id: taskId, userId }).updateAndCount(input);
  if (count === 0) throw new GameError("タスクが見つかりません");
}

export async function getTask(userId: string, taskId: string) {
  return db.orm.public.Task.where({ id: taskId, userId }).first();
}

export type TaskListItem = {
  id: string;
  title: string;
  recurrenceType: RecurrenceType;
  active: boolean;
  judgeable: boolean;
  // 判定できない理由（判定済み・無効など）。判定できるときは null。
  reason: string | null;
};

export async function listTasks(
  userId: string,
  today: string = getJstTodayString(),
): Promise<TaskListItem[]> {
  const tasks = await db.orm.public.Task.where({ userId })
    .include("attempts", (a) => a.select("attemptedOn"))
    .orderBy([(t) => t.createdAt.asc(), (t) => t.id.asc()])
    .all();
  return tasks.map((t) => {
    const check = checkCanJudge(t, t.attempts, today);
    return {
      id: t.id,
      title: t.title,
      recurrenceType: t.recurrenceType,
      active: t.active,
      judgeable: check.ok,
      reason: check.ok ? null : check.error,
    };
  });
}

// ---------- ゲーム ----------

export type GameView = {
  id: string;
  status: GameStatus;
  undoUsed: boolean;
  startedAt: string;
  finishedAt: string | null;
  moves: Move[];
  board: Board;
  summary: GameSummary;
  canUndo: boolean;
  lastMove: (Move & { taskTitle: string; result: AttemptResult }) | null;
};

async function loadGameView(
  userId: string,
  where: { id: string } | { status: GameStatus },
): Promise<GameView | null> {
  const game = await db.orm.public.Game.where({ userId, ...where })
    .include("placements", (p) =>
      p.orderBy((x) => x.sequenceNumber.asc()).include("taskAttempt", (a) =>
        a.include("task", (t) => t.select("title")),
      ),
    )
    .first();
  if (!game) return null;

  const moves: Move[] = game.placements.map((p) => ({ row: p.row, col: p.col, color: p.color }));
  const board = replay(moves);
  const results = game.placements.map((p) => p.taskAttempt!.result);
  const last = game.placements.at(-1);
  return {
    id: game.id,
    status: game.status,
    undoUsed: game.undoUsed,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
    moves,
    board,
    summary: summarizeGame(results, board),
    canUndo: canUndo(game, moves.length),
    lastMove: last
      ? {
          row: last.row,
          col: last.col,
          color: last.color,
          taskTitle: last.taskAttempt!.task!.title,
          result: last.taskAttempt!.result,
        }
      : null,
  };
}

export async function getCurrentGame(userId: string) {
  return loadGameView(userId, { status: "in_progress" });
}

export async function getGame(userId: string, gameId: string) {
  return loadGameView(userId, { id: gameId });
}

export async function listFinishedGames(userId: string): Promise<GameView[]> {
  const games = await db.orm.public.Game.where({ userId, status: "finished" })
    .select("id")
    .orderBy((g) => g.finishedAt.desc())
    .all();
  const views = await Promise.all(games.map((g) => getGame(userId, g.id)));
  return views.filter((v): v is GameView => v !== null);
}

// 進行中のゲームがあればそれを返し、なければ新しく始める。
export async function startNewGame(userId: string): Promise<string> {
  const existing = await db.orm.public.Game.where({ userId, status: "in_progress" }).first();
  if (existing) return existing.id;
  try {
    const game = await db.orm.public.Game.create({ userId });
    return game.id;
  } catch (err) {
    // 同時に開始された場合は部分ユニークインデックスで弾かれるので、先に作られた方を返す。
    if (isUniqueViolation(err)) {
      const game = await db.orm.public.Game.where({ userId, status: "in_progress" }).first();
      if (game) return game.id;
    }
    throw err;
  }
}

export type SubmitMoveInput = {
  taskId: string;
  result: AttemptResult;
} & Position;

// タスク判定と石の配置を1つのトランザクションで保存する。
// 判定だけが保存されて配置されない（石を保留する）状態は作らない。
export async function submitMove(
  userId: string,
  input: SubmitMoveInput,
  today: string = getJstTodayString(),
): Promise<{ gameId: string; finished: boolean }> {
  if (input.result !== "achieved" && input.result !== "missed") {
    throw new GameError("達成か未達成かを選んでください");
  }
  try {
    return await db.transaction(async (tx) => {
      const game = await tx.orm.public.Game.where({ userId, status: "in_progress" }).first();
      if (!game) throw new GameError("進行中のゲームがありません");

      const task = await tx.orm.public.Task.where({ id: input.taskId, userId })
        .include("attempts", (a) => a.select("attemptedOn"))
        .first();
      if (!task) throw new GameError("タスクが見つかりません");
      const check = checkCanJudge(task, task.attempts, today);
      if (!check.ok) throw new GameError(check.error);

      const placements = await tx.orm.public.StonePlacement.where({ gameId: game.id })
        .orderBy((p) => p.sequenceNumber.asc())
        .all();
      const color = stoneColorFor(input.result);
      let next: Board;
      try {
        next = applyMove(replay(placements), { row: input.row, col: input.col }, color).board;
      } catch {
        throw new GameError("そのマスには置けません");
      }

      const attempt = await tx.orm.public.TaskAttempt.create({
        gameId: game.id,
        taskId: task.id,
        result: input.result,
        attemptedOn: today,
      });
      await tx.orm.public.StonePlacement.create({
        gameId: game.id,
        taskAttemptId: attempt.id,
        color,
        row: input.row,
        col: input.col,
        sequenceNumber: placements.length + 1,
      });

      const finished = isFull(next);
      await tx.orm.public.Game.where({ id: game.id }).update(
        finished
          ? { undoUsed: false, status: "finished", finishedAt: new Date().toISOString() }
          : { undoUsed: false },
      );
      return { gameId: game.id, finished };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new GameError(CONFLICT_MESSAGE);
    throw err;
  }
}

// 直前の1手（配置と、それに対応するタスク判定）を取り消す。
export async function undoLastMove(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const game = await tx.orm.public.Game.where({ userId, status: "in_progress" }).first();
    if (!game) throw new GameError("進行中のゲームがありません");

    const last = await tx.orm.public.StonePlacement.where({ gameId: game.id })
      .orderBy((p) => p.sequenceNumber.desc())
      .first();
    if (!canUndo(game, last ? 1 : 0) || !last) {
      throw new GameError("取り消せる操作がありません");
    }

    // undoUsed=false の場合だけ更新することで、同時に2回取り消されるのを防ぐ。
    const claimed = await tx.orm.public.Game.where({ id: game.id, undoUsed: false }).updateAndCount({
      undoUsed: true,
    });
    if (claimed === 0) throw new GameError("取り消せる操作がありません");

    // TaskAttempt を消すと StonePlacement もカスケード削除される。
    await tx.orm.public.TaskAttempt.where({ id: last.taskAttemptId }).delete();
  });
}
