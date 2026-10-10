"use client";

import { useActionState, useState } from "react";
import { deleteTaskAction, type ActionState } from "@/app/actions";

const initialState: ActionState = { error: null };

// 未判定の単発タスクの削除。元に戻せないので、押したあと確認を挟む。
export function DeleteTaskButton({ taskId, title }: { taskId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteTaskAction.bind(null, taskId), initialState);

  if (!confirming) {
    return (
      <div className="text-center text-sm">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-danger underline underline-offset-2"
        >
          このタスクを削除する
        </button>
        {state.error && <p className="mt-1 text-danger">{state.error}</p>}
      </div>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-line bg-card p-3 text-sm">
      <p>「{title}」を削除します。元に戻せません。</p>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-danger px-3 py-1.5 font-bold text-white disabled:opacity-50"
        >
          削除する
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-line px-3 py-1.5"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
