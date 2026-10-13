import { NoGamePanel } from "@/components/NoGamePanel";
import { ReplaceLink } from "@/components/ReplaceLink";
import { ReversiBoard, StoneCounts } from "@/components/ReversiBoard";
import { requireUserId } from "@/lib/auth/session";
import { getCurrentGame } from "@/lib/game/service";
import { CELL_COUNT } from "@/lib/reversi/board";

// 盤面タブ。現在のゲームの盤面・石の数・進み具合と、直前の石の置き直しへの導線を出す。
export default async function BoardPage() {
  const userId = await requireUserId();
  const game = await getCurrentGame(userId);
  if (!game) return <NoGamePanel userId={userId} />;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h1 className="text-lg font-bold">現在のゲーム</h1>
        <p className="text-sm text-ink-soft">
          {game.moves.length} / {CELL_COUNT} 手
        </p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={game.moves.length}
        aria-valuemax={CELL_COUNT}
        aria-label="ゲームの進行状況"
      >
        <div className="h-full bg-felt" style={{ width: `${(game.moves.length / CELL_COUNT) * 100}%` }} />
      </div>
      <ReversiBoard board={game.board} lastMove={game.lastMove} />
      <StoneCounts white={game.summary.white} black={game.summary.black} empty={CELL_COUNT - game.moves.length} />
      {game.lastMove && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
          <p>
            直前: 「{game.lastMove.taskTitle}」
            {game.lastMove.result === "achieved" ? "達成（白）" : "未達成（黒）"}
          </p>
          {game.canReplaceLastMove && <ReplaceLink />}
        </div>
      )}
    </section>
  );
}
