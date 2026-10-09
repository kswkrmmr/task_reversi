import Link from "next/link";
import { ReversiBoard } from "@/components/ReversiBoard";
import { requireUserId } from "@/lib/auth/session";
import { listFinishedGames } from "@/lib/game/service";
import { formatDateTime } from "@/lib/format";

export default async function GamesPage() {
  const userId = await requireUserId();
  const games = await listFinishedGames(userId);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">ゲーム履歴</h1>
      {games.length === 0 ? (
        <p className="text-sm text-ink-soft">終了したゲームはまだありません。</p>
      ) : (
        <ul className="space-y-3">
          {games.map((g) => (
            <li key={g.id}>
              <Link
                href={`/games/${g.id}`}
                className="flex items-center gap-4 rounded-lg border border-line bg-card p-3 hover:border-felt"
              >
                <ReversiBoard board={g.board} className="pointer-events-none w-24 shrink-0 border-2" />
                <div className="text-sm">
                  <p className="font-bold">{formatDateTime(g.finishedAt!)} 終了</p>
                  <p>
                    達成 {g.summary.achieved} / 未達成 {g.summary.missed}（達成率 {g.summary.achievementRate}%）
                  </p>
                  <p className="text-ink-soft">
                    白 {g.summary.white} ・ 黒 {g.summary.black}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
