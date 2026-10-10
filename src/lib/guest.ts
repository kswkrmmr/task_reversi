// ゲスト（ログインせずに試す）ユーザーの定義。
// ゲストの記録はログイン後に引き継がない。セッションは開始から7日で切れ、
// 7日より古いゲストのデータは定期実行（/api/cron/cleanup-guests）で削除する。

export const GUEST_PROVIDER_ID = "guest";
export const GUEST_USER_PREFIX = `${GUEST_PROVIDER_ID}:`;
export const GUEST_TTL_DAYS = 7;
export const GUEST_TTL_MS = GUEST_TTL_DAYS * 24 * 60 * 60 * 1000;

export function isGuestUserId(userId: string): boolean {
  return userId.startsWith(GUEST_USER_PREFIX);
}
