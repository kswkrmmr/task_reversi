import Link from "next/link";
import { notFound } from "next/navigation";
import { updateTaskAction } from "@/app/actions";
import { DeleteTaskButton } from "@/components/DeleteTaskButton";
import { TaskForm } from "@/components/TaskForm";
import { requireUserId } from "@/lib/auth/session";
import { getTask } from "@/lib/game/service";

export default async function EditTaskPage({ params }: PageProps<"/tasks/[id]/edit">) {
  const { id } = await params;
  const userId = await requireUserId();
  const task = await getTask(userId, id);
  if (!task) notFound();

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">タスクを編集</h1>
      <TaskForm
        action={updateTaskAction.bind(null, task.id)}
        defaults={{
          title: task.title,
          recurrenceType: task.recurrenceType,
          active: task.active,
          dueAt: task.dueAt,
        }}
        submitLabel="保存する"
      />
      <Link href="/" className="block text-center text-sm text-ink-soft underline underline-offset-2">
        キャンセル
      </Link>
      {task.recurrenceType === "once" && !task.judged && (
        <div className="border-t border-line pt-5">
          <DeleteTaskButton taskId={task.id} title={task.title} />
        </div>
      )}
    </div>
  );
}
