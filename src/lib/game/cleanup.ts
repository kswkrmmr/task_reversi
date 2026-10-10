import { db } from "@/prisma/db";
import { GUEST_TTL_MS, GUEST_USER_PREFIX } from "@/lib/guest";

// 有効期限（7日）を過ぎたゲストのタスク・ゲームを削除する。
// ゲストのセッションは開始から7日で切れるため、7日より古いデータを1件でも持つゲストは
// すでにログアウト済みであり、そのゲストのデータはすべて削除してよい。
// TaskAttempt / StonePlacement は Game・Task からのカスケードで消える。
export async function deleteExpiredGuestData(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - GUEST_TTL_MS).toISOString();
  const pattern = `${GUEST_USER_PREFIX}%`;

  const [games, tasks] = await Promise.all([
    db.orm.public.Game.where((g) => g.userId.like(pattern))
      .where((g) => g.startedAt.lt(cutoff))
      .select("userId")
      .all(),
    db.orm.public.Task.where((t) => t.userId.like(pattern))
      .where((t) => t.createdAt.lt(cutoff))
      .select("userId")
      .all(),
  ]);
  const userIds = [...new Set([...games, ...tasks].map((r) => r.userId))];
  if (userIds.length === 0) return 0;

  await db.transaction(async (tx) => {
    await tx.orm.public.Game.where((g) => g.userId.in(userIds)).deleteAll();
    await tx.orm.public.Task.where((t) => t.userId.in(userIds)).deleteAll();
  });
  return userIds.length;
}
