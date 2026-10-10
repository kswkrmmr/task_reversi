import { deleteExpiredGuestData } from "@/lib/game/cleanup";

// Vercel Cron から1日1回呼ばれる（vercel.json の crons）。
// Vercel は環境変数 CRON_SECRET を Authorization: Bearer で送ってくるので、それ以外の呼び出しは拒否する。
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const deletedGuests = await deleteExpiredGuestData();
  return Response.json({ deletedGuests });
}
