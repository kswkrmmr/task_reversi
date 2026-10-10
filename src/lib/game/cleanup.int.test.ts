import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/prisma/db";
import { deleteExpiredGuestData } from "./cleanup";
import { createTask, getCurrentGame, listTasks, startNewGame, submitMove } from "./service";

const NOW = new Date("2026-10-20T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
const users: string[] = [];

afterAll(async () => {
  for (const userId of users) {
    await db.orm.public.Game.where({ userId }).deleteAll();
    await db.orm.public.Task.where({ userId }).deleteAll();
  }
  await db.close();
});

// 指定日時に開始したゲームと、そのゲームで1手置いたタスクを持つユーザーを作る。
async function seedUser(prefix: string, startedDaysAgo: number): Promise<string> {
  const userId = `${prefix}${randomUUID()}`;
  users.push(userId);
  await db.orm.public.Game.create({ userId, startedAt: daysAgo(startedDaysAgo) });
  await db.orm.public.Task.create({
    userId,
    title: "t",
    recurrenceType: "once",
    createdAt: daysAgo(startedDaysAgo),
  });
  const [task] = await listTasks(userId);
  await submitMove(userId, { taskId: task.id, result: "achieved", row: 0, col: 0 });
  return userId;
}

describe("deleteExpiredGuestData", () => {
  it("7日より古いゲストのデータだけを、判定・配置も含めて削除する", async () => {
    const oldGuest = await seedUser("guest:", 8);
    const newGuest = await seedUser("guest:", 1);
    const oldMember = await seedUser("github:test-", 30);
    const oldGameId = (await getCurrentGame(oldGuest))!.id;

    const deleted = await deleteExpiredGuestData(NOW);
    expect(deleted).toBeGreaterThanOrEqual(1);

    expect(await getCurrentGame(oldGuest)).toBeNull();
    expect(await listTasks(oldGuest)).toEqual([]);
    expect(await db.orm.public.TaskAttempt.where({ gameId: oldGameId }).all()).toEqual([]);
    expect(await db.orm.public.StonePlacement.where({ gameId: oldGameId }).all()).toEqual([]);

    expect((await getCurrentGame(newGuest))!.moves).toHaveLength(1);
    expect((await getCurrentGame(oldMember))!.moves).toHaveLength(1);
    expect(await listTasks(oldMember)).toHaveLength(1);
  });

  it("古いタスクを持つゲストは、ゲームが新しくてもまとめて削除する", async () => {
    const userId = `guest:${randomUUID()}`;
    users.push(userId);
    await createTask(userId, { title: "t", recurrenceType: "daily" });
    await db.orm.public.Task.where({ userId }).updateAll({ createdAt: daysAgo(10) });
    await startNewGame(userId);

    await deleteExpiredGuestData(NOW);
    expect(await listTasks(userId)).toEqual([]);
  });

  it("削除対象がなければ0を返す", async () => {
    expect(await deleteExpiredGuestData(new Date("2000-01-01T00:00:00Z"))).toBe(0);
  });
});
