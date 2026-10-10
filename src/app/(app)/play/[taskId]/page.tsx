import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlayFlow } from "@/components/PlayFlow";
import { ReplaceLink } from "@/components/ReplaceLink";
import { requireUserId } from "@/lib/auth/session";
import { describeDue } from "@/lib/game/rules";
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
        recurrenceType={task.recurrenceType}
        dueAt={task.dueAt}
        due={task.dueAt ? describeDue(task.dueAt, new Date()) : null}
        moves={game.moves}
        lastMove={game.lastMove}
      />
      {game.canReplaceLastMove && (
        <div className="flex justify-center">
          <ReplaceLink />
        </div>
      )}
    </div>
  );
}
