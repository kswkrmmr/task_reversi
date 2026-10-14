import Link from "next/link";
import { notFound } from "next/navigation";
import { startNewGameAction } from "@/app/actions";
import { GameSummary } from "@/components/GameSummary";
import { JudgmentList } from "@/components/JudgmentList";
import { ReversiBoard } from "@/components/ReversiBoard";
import { requireUserId } from "@/lib/auth/session";
import { getCurrentGame, getGame } from "@/lib/game/service";
import { formatDateTime } from "@/lib/format";

export default async function GameResultPage({ params }: PageProps<"/games/[id]">) {
  const { id } = await params;
  const userId = await requireUserId();
  const [game, current] = await Promise.all([getGame(userId, id), getCurrentGame(userId)]);
  if (!game) notFound();

  if (game.status !== "finished") {
    return (
      <div className="space-y-3 text-center">
        <p>このゲームはまだ進行中です。</p>
        <Link href="/" className="text-sm underline underline-offset-2">タスク一覧に戻る</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-bold">ゲーム終了！</h1>
        <p className="text-sm text-ink-soft">
          {formatDateTime(game.startedAt)} 〜 {formatDateTime(game.finishedAt!)}
        </p>
      </div>
      <ReversiBoard board={game.board} />
      <GameSummary summary={game.summary} />
      <p className="text-center text-xs text-ink-soft">
        反転があるため、盤面の石の数とタスクの達成数は一致しません。
      </p>
      <JudgmentList judgments={game.judgments} />
      {current ? (
        <Link
          href="/board"
          className="block rounded-md bg-felt px-4 py-3 text-center font-bold text-white hover:bg-felt-dark"
        >
          進行中のゲームへ
        </Link>
      ) : (
        <form action={startNewGameAction}>
          <button
            type="submit"
            className="w-full rounded-md bg-felt px-4 py-3 font-bold text-white hover:bg-felt-dark"
          >
            新しいゲームを始める
          </button>
        </form>
      )}
      <Link href="/games" className="block text-center text-sm underline underline-offset-2">
        ゲーム履歴を見る
      </Link>
    </div>
  );
}
