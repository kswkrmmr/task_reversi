import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/prisma/db";
import { placeableCells } from "@/lib/reversi/board";
import {
  createTask,
  GameError,
  getCurrentGame,
  getGame,
  listFinishedGames,
  listTasks,
  startNewGame,
  submitMove,
  undoLastMove,
  updateTask,
} from "./service";

const TODAY = "2026-10-09";
const createdUsers: string[] = [];

function newUser(): string {
  const id = `test:${randomUUID()}`;
  createdUsers.push(id);
  return id;
}

afterAll(async () => {
  for (const userId of createdUsers) {
    await db.orm.public.Game.where({ userId }).deleteAll();
    await db.orm.public.Task.where({ userId }).deleteAll();
  }
  await db.close();
});

let user: string;
beforeEach(() => {
  user = newUser();
});

describe("submitMove", () => {
  it("達成なら白石、未達成なら黒石を置き、判定と配置を保存する", async () => {
    await startNewGame(user);
    const a = await createTask(user, { title: "README修正", recurrenceType: "once" });
    const b = await createTask(user, { title: "掃除", recurrenceType: "once" });

    await submitMove(user, { taskId: a.id, result: "achieved", row: 3, col: 3 }, TODAY);
    await submitMove(user, { taskId: b.id, result: "missed", row: 3, col: 4 }, TODAY);

    const game = (await getCurrentGame(user))!;
    expect(game.board[3][3]).toBe("white");
    expect(game.board[3][4]).toBe("black");
    expect(game.summary).toMatchObject({ achieved: 1, missed: 1, judged: 2, achievementRate: 50 });
    expect(game.lastMove).toMatchObject({ taskTitle: "掃除", result: "missed" });
  });

  it("挟んだ石を反転し、再読み込みしても反転後の盤面が再構築される", async () => {
    await startNewGame(user);
    const tasks = await Promise.all(
      [1, 2, 3].map((i) => createTask(user, { title: `t${i}`, recurrenceType: "once" })),
    );
    await submitMove(user, { taskId: tasks[0].id, result: "achieved", row: 0, col: 0 }, TODAY);
    await submitMove(user, { taskId: tasks[1].id, result: "missed", row: 0, col: 1 }, TODAY);
    await submitMove(user, { taskId: tasks[2].id, result: "achieved", row: 0, col: 2 }, TODAY);

    const game = (await getCurrentGame(user))!;
    expect(game.board[0].slice(0, 3)).toEqual(["white", "white", "white"]);
    expect(game.summary).toMatchObject({ white: 3, black: 0, achieved: 2, missed: 1 });
  });

  it("配置ルールに反するマス・使用済みのマスには置けず、判定も保存されない", async () => {
    await startNewGame(user);
    const a = await createTask(user, { title: "a", recurrenceType: "once" });
    const b = await createTask(user, { title: "b", recurrenceType: "once" });
    await submitMove(user, { taskId: a.id, result: "achieved", row: 0, col: 0 }, TODAY);

    await expect(
      submitMove(user, { taskId: b.id, result: "missed", row: 0, col: 0 }, TODAY),
    ).rejects.toThrow(GameError);
    await expect(
      submitMove(user, { taskId: b.id, result: "missed", row: 5, col: 5 }, TODAY),
    ).rejects.toThrow("そのマスには置けません");

    const game = (await getCurrentGame(user))!;
    expect(game.moves).toHaveLength(1);
    const items = await listTasks(user, TODAY);
    expect(items.find((t) => t.id === b.id)?.judgeable).toBe(true);
  });

  it("単発タスクは重複して判定できない（別の日・別のゲームでも）", async () => {
    await startNewGame(user);
    const a = await createTask(user, { title: "a", recurrenceType: "once" });
    await submitMove(user, { taskId: a.id, result: "achieved", row: 0, col: 0 }, TODAY);

    await expect(
      submitMove(user, { taskId: a.id, result: "achieved", row: 0, col: 1 }, "2026-10-10"),
    ).rejects.toThrow("このタスクはすでに判定済みです");
    const items = await listTasks(user, "2026-10-10");
    expect(items[0]).toMatchObject({ judgeable: false, reason: "このタスクはすでに判定済みです" });
  });

  it("繰り返しタスクは1日1回、日が変われば再び判定できる", async () => {
    await startNewGame(user);
    const walk = await createTask(user, { title: "30分歩く", recurrenceType: "daily" });
    await submitMove(user, { taskId: walk.id, result: "achieved", row: 0, col: 0 }, "2026-10-08");
    await submitMove(user, { taskId: walk.id, result: "missed", row: 0, col: 1 }, "2026-10-09");

    await expect(
      submitMove(user, { taskId: walk.id, result: "achieved", row: 1, col: 1 }, "2026-10-09"),
    ).rejects.toThrow("このタスクは今日すでに判定済みです");
    expect((await getCurrentGame(user))!.moves).toHaveLength(2);
  });

  it("無効なタスクは判定できない", async () => {
    await startNewGame(user);
    const a = await createTask(user, { title: "a", recurrenceType: "daily" });
    await updateTask(user, a.id, { title: "a", recurrenceType: "daily", active: false });
    await expect(
      submitMove(user, { taskId: a.id, result: "achieved", row: 0, col: 0 }, TODAY),
    ).rejects.toThrow("無効なタスクは判定できません");
  });

  // 互いに隣接しないマスなので、順番に処理されても2手目以降はルール違反になり1手だけが成立する。
  it("同時に配置しても1手だけ成立し、残りは利用者向けのエラーになる", async () => {
    await startNewGame(user);
    const tasks = await Promise.all(
      [1, 2, 3, 4].map((i) => createTask(user, { title: `t${i}`, recurrenceType: "once" })),
    );
    const results = await Promise.allSettled(
      tasks.map((t, i) => submitMove(user, { taskId: t.id, result: "achieved", row: 0, col: i * 2 }, TODAY)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(GameError);
    }
    expect((await getCurrentGame(user))!.moves).toHaveLength(1);
  });

  it("進行中のゲームがなければ判定できない", async () => {
    const a = await createTask(user, { title: "a", recurrenceType: "once" });
    await expect(
      submitMove(user, { taskId: a.id, result: "achieved", row: 0, col: 0 }, TODAY),
    ).rejects.toThrow("進行中のゲームがありません");
  });
});

describe("undoLastMove", () => {
  it("直前の配置と反転を戻し、タスクを未判定に戻す", async () => {
    await startNewGame(user);
    const tasks = await Promise.all(
      [1, 2, 3].map((i) => createTask(user, { title: `t${i}`, recurrenceType: "once" })),
    );
    await submitMove(user, { taskId: tasks[0].id, result: "achieved", row: 0, col: 0 }, TODAY);
    await submitMove(user, { taskId: tasks[1].id, result: "missed", row: 0, col: 1 }, TODAY);
    await submitMove(user, { taskId: tasks[2].id, result: "achieved", row: 0, col: 2 }, TODAY);

    await undoLastMove(user);

    const game = (await getCurrentGame(user))!;
    expect(game.board[0].slice(0, 3)).toEqual(["white", "black", null]);
    expect(game.summary.judged).toBe(2);
    expect(game.canUndo).toBe(false);

    // 取り消したタスクは再判定でき、結果を変えてやり直せる
    const items = await listTasks(user, TODAY);
    expect(items.find((t) => t.id === tasks[2].id)?.judgeable).toBe(true);
    await submitMove(user, { taskId: tasks[2].id, result: "missed", row: 1, col: 1 }, TODAY);
    expect((await getCurrentGame(user))!.board[1][1]).toBe("black");
  });

  it("取り消しは連続1回まで。次の手を置けば再び取り消せる", async () => {
    await startNewGame(user);
    const tasks = await Promise.all(
      [1, 2, 3].map((i) => createTask(user, { title: `t${i}`, recurrenceType: "once" })),
    );
    await submitMove(user, { taskId: tasks[0].id, result: "achieved", row: 0, col: 0 }, TODAY);
    await submitMove(user, { taskId: tasks[1].id, result: "achieved", row: 0, col: 1 }, TODAY);

    await undoLastMove(user);
    await expect(undoLastMove(user)).rejects.toThrow("取り消せる操作がありません");

    await submitMove(user, { taskId: tasks[2].id, result: "achieved", row: 1, col: 1 }, TODAY);
    expect((await getCurrentGame(user))!.canUndo).toBe(true);
    await undoLastMove(user);
    expect((await getCurrentGame(user))!.moves).toHaveLength(1);
  });

  it("配置がなければ取り消せない", async () => {
    await startNewGame(user);
    await expect(undoLastMove(user)).rejects.toThrow("取り消せる操作がありません");
  });
});

describe("ゲーム終了と新しいゲーム", () => {
  async function fillBoard(userId: string): Promise<string> {
    const gameId = await startNewGame(userId);
    for (let i = 0; i < 64; i++) {
      const task = await createTask(userId, { title: `task${i}`, recurrenceType: "once" });
      const result = i % 4 === 0 ? "missed" : "achieved";
      const game = (await getCurrentGame(userId))!;
      const cell = placeableCells(game.board, result === "achieved" ? "white" : "black")[0];
      const { finished } = await submitMove(userId, { taskId: task.id, result, ...cell }, TODAY);
      expect(finished).toBe(i === 63);
    }
    return gameId;
  }

  it("64マス埋まるとゲームが終了し、結果を集計する。終了後は取り消せない", async () => {
    const gameId = await fillBoard(user);

    expect(await getCurrentGame(user)).toBeNull();
    const game = (await getGame(user, gameId))!;
    expect(game.status).toBe("finished");
    expect(game.finishedAt).not.toBeNull();
    expect(game.summary).toMatchObject({ achieved: 48, missed: 16, judged: 64, achievementRate: 75 });
    expect(game.summary.white + game.summary.black).toBe(64);
    expect(game.canUndo).toBe(false);
    await expect(undoLastMove(user)).rejects.toThrow("進行中のゲームがありません");
  });

  it("新しいゲームは空の盤面で始まり、過去の結果とタスクは保持される", async () => {
    const oldId = await fillBoard(user);
    const daily = await createTask(user, { title: "毎日コード", recurrenceType: "daily" });

    const newId = await startNewGame(user);
    expect(newId).not.toBe(oldId);
    const current = (await getCurrentGame(user))!;
    expect(current.moves).toEqual([]);
    expect(current.summary.judged).toBe(0);

    const history = await listFinishedGames(user);
    expect(history.map((g) => g.id)).toEqual([oldId]);
    expect(history[0].moves).toHaveLength(64);

    const items = await listTasks(user, TODAY);
    expect(items).toHaveLength(65);
    expect(items.find((t) => t.id === daily.id)?.judgeable).toBe(true);
  });

  it("進行中のゲームは1つだけ（同時に開始しても1つにまとまる）", async () => {
    const ids = await Promise.all([startNewGame(user), startNewGame(user), startNewGame(user)]);
    expect(new Set(ids).size).toBe(1);
  });
});

describe("ユーザーごとのアクセス制御", () => {
  it("他ユーザーのタスク・ゲームは読めず、変更・判定もできない", async () => {
    const other = newUser();
    const otherGameId = await startNewGame(other);
    const otherTask = await createTask(other, { title: "他人のタスク", recurrenceType: "daily" });

    await startNewGame(user);
    expect(await listTasks(user, TODAY)).toEqual([]);
    expect(await getGame(user, otherGameId)).toBeNull();
    await expect(
      updateTask(user, otherTask.id, { title: "乗っ取り", recurrenceType: "once", active: false }),
    ).rejects.toThrow("タスクが見つかりません");
    await expect(
      submitMove(user, { taskId: otherTask.id, result: "achieved", row: 0, col: 0 }, TODAY),
    ).rejects.toThrow("タスクが見つかりません");

    const otherItems = await listTasks(other, TODAY);
    expect(otherItems[0]).toMatchObject({ title: "他人のタスク", active: true, judgeable: true });
  });

  it("他ユーザーのゲームの取り消しはできない", async () => {
    const other = newUser();
    await startNewGame(other);
    const t = await createTask(other, { title: "x", recurrenceType: "once" });
    await submitMove(other, { taskId: t.id, result: "achieved", row: 0, col: 0 }, TODAY);

    await expect(undoLastMove(user)).rejects.toThrow("進行中のゲームがありません");
    expect((await getCurrentGame(other))!.moves).toHaveLength(1);
  });
});
