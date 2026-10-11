import Link from "next/link";
import { startNewGameAction } from "@/app/actions";
import { getLatestFinishedGameId } from "@/lib/game/service";

// 進行中のゲームがないときに、タスク・盤面タブの上部に出す案内。
export async function NoGamePanel({ userId }: { userId: string }) {
  const latestId = await getLatestFinishedGameId(userId);
  return (
    <section className="space-y-3 rounded-lg border border-line bg-card p-5 text-center">
      <p className="font-bold">{latestId ? "ゲームが終了しました" : "ようこそ！"}</p>
      <p className="text-sm text-ink-soft">
        {latestId
          ? "新しいゲームを始めると、空の盤面からスタートします。タスクは引き継がれます。"
          : "タスクを登録して、ゲームを始めましょう。"}
      </p>
      <form action={startNewGameAction}>
        <button
          type="submit"
          className="rounded-md bg-felt px-5 py-2.5 font-bold text-white hover:bg-felt-dark"
        >
          新しいゲームを始める
        </button>
      </form>
      {latestId && (
        <Link href={`/games/${latestId}`} className="inline-block text-sm underline underline-offset-2">
          前回の結果を見る
        </Link>
      )}
    </section>
  );
}
