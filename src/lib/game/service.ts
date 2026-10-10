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
  canReplaceLastMove,
  checkCanJudge,
  getJstTodayString,
  jstLocalInputToIso,
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

// dueAt は単発タスクの期限（ISO文字列、任意）。毎日タスクでは常に null。
export type TaskInput = { title: string; recurrenceType: RecurrenceType; dueAt?: string | null };

// DB の timestamptz は "2026-10-12 09:00:00+00" 形式の文字列で返るので、ISO 形式に揃える。
function toIsoOrNull(value: string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

// 毎日タスクは期限を持たないので null に揃える。
function taskColumns(input: TaskInput) {
  return {
    title: input.title,
    recurrenceType: input.recurrenceType,
    dueAt: input.recurrenceType === "once" ? (input.dueAt ?? null) : null,
  };
}

// dueInput は <input type="datetime-local"> の値（日本時間）。空なら期限なし。
export function validateTaskInput(
  title: unknown,
  recurrenceType: unknown,
  dueInput: unknown = "",
): TaskInput {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (trimmed.length === 0) throw new GameError("タスク名を入力してください");
  if (trimmed.length > 100) throw new GameError("タスク名は100文字以内にしてください");
  if (recurrenceType !== "once" && recurrenceType !== "daily") {
    throw new GameError("単発か繰り返しかを選んでください");
  }
  if (recurrenceType === "daily") return { title: trimmed, recurrenceType, dueAt: null };

  const raw = typeof dueInput === "string" ? dueInput.trim() : "";
  if (raw === "") return { title: trimmed, recurrenceType, dueAt: null };
  const dueAt = jstLocalInputToIso(raw);
  if (!dueAt) throw new GameError("期限の日時が正しくありません");
  return { title: trimmed, recurrenceType, dueAt };
}

export async function createTask(userId: string, input: TaskInput) {
  return db.orm.public.Task.create({ userId, ...taskColumns(input), active: true });
}

// 単発タスクは一時停止しないので、単発に変えたとき（または単発のまま保存したとき）は active を true に戻す。
export async function updateTask(
  userId: string,
  taskId: string,
  input: TaskInput & { active: boolean },
) {
  const active = input.recurrenceType === "once" ? true : input.active;
  const count = await db.orm.public.Task.where({ id: taskId, userId }).updateAndCount({
    ...taskColumns(input),
    active,
  });
  if (count === 0) throw new GameError("タスクが見つかりません");
}

// 削除できるのは、まだ判定していない単発タスクだけ。
// 判定済みのタスクは盤面の石や結果の集計に使われているので消さない（毎日タスクは一時停止で代用する）。
export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const task = await tx.orm.public.Task.where({ id: taskId, userId })
      .include("attempts", (a) => a.select("id"))
      .first();
    if (!task) throw new GameError("タスクが見つかりません");
    if (task.recurrenceType !== "once") {
      throw new GameError("毎日のタスクは削除できません。一時停止を使ってください");
    }
    if (task.attempts.length > 0) throw new GameError("判定済みのタスクは削除できません");
    await tx.orm.public.Task.where({ id: task.id }).delete();
  });
}

export async function getTask(userId: string, taskId: string) {
  const task = await db.orm.public.Task.where({ id: taskId, userId })
    .include("attempts", (a) => a.select("id"))
    .first();
  if (!task) return null;
  const { attempts, ...rest } = task;
  return { ...rest, dueAt: toIsoOrNull(rest.dueAt), judged: attempts.length > 0 };
}

// open: これから判定できる（または今日は判定済みの毎日タスク） / paused: 一時停止中の毎日タスク
// judged: 判定済みの単発タスク
export type TaskCategory = "open" | "paused" | "judged";

export type TaskListItem = {
  id: string;
  title: string;
  recurrenceType: RecurrenceType;
  dueAt: string | null;
  category: TaskCategory;
  // 判定済みの単発タスクの結果。それ以外は null。
  result: AttemptResult | null;
  judgeable: boolean;
  // 判定できない理由（判定済み・一時停止中など）。判定できるときは null。
  reason: string | null;
};

export async function listTasks(
  userId: string,
  today: string = getJstTodayString(),
): Promise<TaskListItem[]> {
  const tasks = await db.orm.public.Task.where({ userId })
    .include("attempts", (a) => a.select("attemptedOn", "result"))
    .orderBy([(t) => t.createdAt.asc(), (t) => t.id.asc()])
    .all();
  return tasks.map((t) => {
    const check = checkCanJudge(t, t.attempts, today);
    const judgedOnce = t.recurrenceType === "once" && t.attempts.length > 0;
    return {
      id: t.id,
      title: t.title,
      recurrenceType: t.recurrenceType,
      dueAt: toIsoOrNull(t.dueAt),
      category: judgedOnce ? "judged" : t.recurrenceType === "daily" && !t.active ? "paused" : "open",
      result: judgedOnce ? t.attempts[0].result : null,
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
  canReplaceLastMove: boolean;
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
    canReplaceLastMove: canReplaceLastMove(game, moves.length),
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

// 直前の1手の石を別のマスに置き直す。タスクの判定（石の色）はそのまま。
// 元の石の削除と新しい位置への配置を1つの更新で行うので、「石が置かれていない」状態はDBに生まれない。
export async function replaceLastMove(userId: string, pos: Position): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const game = await tx.orm.public.Game.where({ userId, status: "in_progress" }).first();
      if (!game) throw new GameError("進行中のゲームがありません");

      const placements = await tx.orm.public.StonePlacement.where({ gameId: game.id })
        .orderBy((p) => p.sequenceNumber.asc())
        .all();
      const last = placements.at(-1);
      if (!last || !canReplaceLastMove(game, placements.length)) {
        throw new GameError("置き直せる石がありません");
      }
      if (last.row === pos.row && last.col === pos.col) {
        throw new GameError("元と同じマスです。別のマスを選んでください");
      }
      try {
        applyMove(replay(placements.slice(0, -1)), pos, last.color);
      } catch {
        throw new GameError("そのマスには置けません");
      }

      // undoUsed=false の場合だけ更新することで、同時に2回置き直されるのを防ぐ。
      const claimed = await tx.orm.public.Game.where({ id: game.id, undoUsed: false }).updateAndCount({
        undoUsed: true,
      });
      if (claimed === 0) throw new GameError("置き直せる石がありません");

      await tx.orm.public.StonePlacement.where({ id: last.id }).update({ row: pos.row, col: pos.col });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new GameError(CONFLICT_MESSAGE);
    throw err;
  }
}
