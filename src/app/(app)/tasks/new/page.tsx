import Link from "next/link";
import { createTaskAction } from "@/app/actions";
import { TaskForm } from "@/components/TaskForm";

export default function NewTaskPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">タスクを追加</h1>
      <TaskForm action={createTaskAction} submitLabel="追加する" />
      <Link href="/" className="block text-center text-sm text-ink-soft underline underline-offset-2">
        キャンセル
      </Link>
    </div>
  );
}
