import Link from "next/link";
import { startNewGameAction } from "@/app/actions";
import { listFinishedGames } from "@/lib/game/service";

// 進行中のゲームがないときに、タスク・盤面タブの上部に出す案内。
export async function NoGamePanel({ userId }: { userId: string }) {
  const [latest] = await listFinishedGames(userId);
  return (
    <section className="space-y-3 rounded-lg border border-line bg-card p-5 text-center">
      <p className="font-bold">{latest ? "ゲームが終了しました" : "ようこそ！"}</p>
      <p className="text-sm text-ink-soft">
        {latest
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
      {latest && (
        <Link href={`/games/${latest.id}`} className="inline-block text-sm underline underline-offset-2">
          前回の結果を見る
        </Link>
      )}
    </section>
  );
}
