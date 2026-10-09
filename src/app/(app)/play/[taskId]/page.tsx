import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlayFlow } from "@/components/PlayFlow";
import { UndoButton } from "@/components/UndoButton";
import { requireUserId } from "@/lib/auth/session";
import { getCurrentGame, listTasks } from "@/lib/game/service";

export default async function PlayPage({ params }: PageProps<"/play/[taskId]">) {
  const { taskId } = await params;
  const userId = await requireUserId();
  const [game, tasks] = await Promise.all([getCurrentGame(userId), listTasks(userId)]);
  if (!game) redirect("/");
  const task = tasks.find((t) => t.id === taskId);
  if (!task) notFound();

  if (!task.judgeable) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-bold">{task.title}</p>
        <p className="text-sm text-ink-soft">{task.reason}</p>
        <Link href="/" className="text-sm underline underline-offset-2">
          ホームに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PlayFlow
        taskId={task.id}
        taskTitle={task.title}
        moves={game.moves}
        lastMove={game.lastMove}
      />
      {game.canUndo && game.lastMove && (
        <div className="flex justify-center">
          <UndoButton description={game.lastMove.taskTitle} />
        </div>
      )}
    </div>
  );
}
