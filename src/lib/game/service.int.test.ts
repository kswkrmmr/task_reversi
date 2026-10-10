import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/prisma/db";
import { placeableCells } from "@/lib/reversi/board";
import {
  createTask,
  deleteTask,
  GameError,
  getCurrentGame,
  getGame,
  getTask,
  listFinishedGames,
  listTasks,
  replaceLastMove,
  startNewGame,
  submitMove,
  updateTask,
  validateTaskInput,
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

  it("一時停止中のタスクは判定できない", async () => {
    await startNewGame(user);
    const a = await createTask(user, { title: "a", recurrenceType: "daily" });
    await updateTask(user, a.id, { title: "a", recurrenceType: "daily", active: false });
    await expect(
      submitMove(user, { taskId: a.id, result: "achieved", row: 0, col: 0 }, TODAY),
    ).rejects.toThrow("一時停止中のタスクは判定できません");
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

describe("replaceLastMove", () => {
  // 白(3,3) → 黒(3,4) → 白(3,5)〔(3,4)を反転〕→ 黒(2,3) → 黒(4,3)〔(3,3)を反転〕と置いた状態を作る。
  // 5手目の黒は (4,3) と (4,5) のどちらにも置ける（(4,5) なら (3,4) を反転する）。
  async function setup() {
    await startNewGame(user);
    const tasks = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((i) => createTask(user, { title: `t${i}`, recurrenceType: "once" })),
    );
    const moves = [
      ["achieved", 3, 3],
      ["missed", 3, 4],
      ["achieved", 3, 5],
      ["missed", 2, 3],
      ["missed", 4, 3],
    ] as const;
    for (const [i, [result, row, col]] of moves.entries()) {
      await submitMove(user, { taskId: tasks[i].id, result, row, col }, TODAY);
    }
    return tasks;
  }

  it("直前の石だけを別のマスへ移し、反転を計算し直す。判定はそのまま", async () => {
    const tasks = await setup();
    const before = (await getCurrentGame(user))!.board;
    expect([before[3][3], before[3][4]]).toEqual(["black", "white"]);

    await replaceLastMove(user, { row: 4, col: 5 });

    const game = (await getCurrentGame(user))!;
    expect(game.board[4][3]).toBeNull();
    expect(game.board[4][5]).toBe("black");
    // 元の位置で反転していた (3,3) は白に戻り、新しい位置で (3,4) が反転する
    expect([game.board[3][3], game.board[3][4]]).toEqual(["white", "black"]);
    expect(game.moves).toHaveLength(5);
    expect(game.summary).toMatchObject({ achieved: 2, missed: 3, judged: 5 });
    expect(game.lastMove).toMatchObject({ row: 4, col: 5, taskTitle: "t5", result: "missed" });
    expect(game.canReplaceLastMove).toBe(false);

    // 判定は残っているので、同じ単発タスクを判定し直すことはできない
    const items = await listTasks(user, TODAY);
    expect(items.find((t) => t.id === tasks[4].id)?.judgeable).toBe(false);
  });

  it("置き直しは1手につき1回まで。次の手を置けば再び置き直せる", async () => {
    const tasks = await setup();
    await replaceLastMove(user, { row: 4, col: 5 });
    await expect(replaceLastMove(user, { row: 4, col: 3 })).rejects.toThrow("置き直せる石がありません");

    const game = (await getCurrentGame(user))!;
    const [cell] = placeableCells(game.board, "white");
    await submitMove(user, { taskId: tasks[5].id, result: "achieved", ...cell }, TODAY);
    expect((await getCurrentGame(user))!.canReplaceLastMove).toBe(true);
  });

  it("ルール上置けないマス・元と同じマスには置き直せず、置き直しの権利も消費しない", async () => {
    await setup();
    await expect(replaceLastMove(user, { row: 7, col: 7 })).rejects.toThrow("そのマスには置けません");
    await expect(replaceLastMove(user, { row: 3, col: 4 })).rejects.toThrow("そのマスには置けません");
    await expect(replaceLastMove(user, { row: 4, col: 3 })).rejects.toThrow("元と同じマスです");

    const game = (await getCurrentGame(user))!;
    expect(game.board[4][3]).toBe("black");
    expect(game.canReplaceLastMove).toBe(true);
  });

  it("配置がなければ置き直せない", async () => {
    await startNewGame(user);
    await expect(replaceLastMove(user, { row: 0, col: 0 })).rejects.toThrow("置き直せる石がありません");
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

  it("64マス埋まるとゲームが終了し、結果を集計する。終了後は置き直せない", async () => {
    const gameId = await fillBoard(user);

    expect(await getCurrentGame(user)).toBeNull();
    const game = (await getGame(user, gameId))!;
    expect(game.status).toBe("finished");
    expect(game.finishedAt).not.toBeNull();
    expect(game.summary).toMatchObject({ achieved: 48, missed: 16, judged: 64, achievementRate: 75 });
    expect(game.summary.white + game.summary.black).toBe(64);
    expect(game.canReplaceLastMove).toBe(false);
    await expect(replaceLastMove(user, { row: 0, col: 0 })).rejects.toThrow("進行中のゲームがありません");
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
    expect(otherItems[0]).toMatchObject({ title: "他人のタスク", category: "open", judgeable: true });
  });

  it("他ユーザーのゲームの石は置き直せない", async () => {
    const other = newUser();
    await startNewGame(other);
    const t = await createTask(other, { title: "x", recurrenceType: "once" });
    await submitMove(other, { taskId: t.id, result: "achieved", row: 0, col: 0 }, TODAY);

    await expect(replaceLastMove(user, { row: 1, col: 1 })).rejects.toThrow("進行中のゲームがありません");
    expect((await getCurrentGame(other))!.moves).toHaveLength(1);
  });
});

describe("タスクの期限・削除・分類", () => {
  it("単発タスクの期限は日本時間として保存し、毎日タスクの期限は無視する", async () => {
    expect(validateTaskInput("a", "once", "2026-10-12T18:00")).toEqual({
      title: "a",
      recurrenceType: "once",
      dueAt: "2026-10-12T09:00:00.000Z",
    });
    expect(validateTaskInput("a", "once", "")).toMatchObject({ dueAt: null });
    expect(validateTaskInput("a", "daily", "2026-10-12T18:00")).toMatchObject({ dueAt: null });
    expect(() => validateTaskInput("a", "once", "2026-02-30T10:00")).toThrow("期限の日時が正しくありません");

    const once = await createTask(user, validateTaskInput("期限つき", "once", "2026-10-12T18:00"));
    await createTask(user, { title: "毎日", recurrenceType: "daily", dueAt: "2026-10-12T09:00:00.000Z" });
    const items = await listTasks(user, TODAY);
    expect(items.find((t) => t.id === once.id)).toMatchObject({
      dueAt: "2026-10-12T09:00:00.000Z",
      category: "open",
    });
    expect(items.find((t) => t.title === "毎日")?.dueAt).toBeNull();
  });

  it("判定済みの単発タスクは「判定済み」に分類し、結果を持つ。毎日タスクは判定しても open のまま", async () => {
    await startNewGame(user);
    const once = await createTask(user, { title: "単発", recurrenceType: "once" });
    const daily = await createTask(user, { title: "毎日", recurrenceType: "daily" });
    await submitMove(user, { taskId: once.id, result: "missed", row: 0, col: 0 }, TODAY);
    await submitMove(user, { taskId: daily.id, result: "achieved", row: 0, col: 1 }, TODAY);

    const items = await listTasks(user, TODAY);
    expect(items.find((t) => t.id === once.id)).toMatchObject({ category: "judged", result: "missed" });
    expect(items.find((t) => t.id === daily.id)).toMatchObject({ category: "open", result: null });
  });

  it("一時停止は毎日タスクだけ。単発に変えると一時停止は解除される", async () => {
    const task = await createTask(user, { title: "歩く", recurrenceType: "daily" });
    await updateTask(user, task.id, { title: "歩く", recurrenceType: "daily", active: false });
    expect((await listTasks(user, TODAY))[0]).toMatchObject({ category: "paused", judgeable: false });

    await updateTask(user, task.id, { title: "歩く", recurrenceType: "once", active: false });
    expect((await listTasks(user, TODAY))[0]).toMatchObject({ category: "open", judgeable: true });
    expect((await getTask(user, task.id))?.active).toBe(true);
  });

  it("削除できるのは未判定の単発タスクだけ", async () => {
    await startNewGame(user);
    const fresh = await createTask(user, { title: "未判定", recurrenceType: "once" });
    const judged = await createTask(user, { title: "判定済み", recurrenceType: "once" });
    const daily = await createTask(user, { title: "毎日", recurrenceType: "daily" });
    await submitMove(user, { taskId: judged.id, result: "achieved", row: 0, col: 0 }, TODAY);

    await deleteTask(user, fresh.id);
    await expect(deleteTask(user, judged.id)).rejects.toThrow("判定済みのタスクは削除できません");
    await expect(deleteTask(user, daily.id)).rejects.toThrow("毎日のタスクは削除できません");
    expect((await listTasks(user, TODAY)).map((t) => t.title).sort()).toEqual(["判定済み", "毎日"]);
    expect((await getCurrentGame(user))!.moves).toHaveLength(1);
  });

  it("他ユーザーのタスクは削除できない", async () => {
    const other = newUser();
    const task = await createTask(other, { title: "他人の", recurrenceType: "once" });
    await expect(deleteTask(user, task.id)).rejects.toThrow("タスクが見つかりません");
    expect(await listTasks(other, TODAY)).toHaveLength(1);
  });
});
