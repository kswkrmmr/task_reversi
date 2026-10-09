"use client";

import { useActionState, useState } from "react";
import { undoLastMoveAction, type ActionState } from "@/app/actions";

const initialState: ActionState = { error: null };

// 直前の1手を取り消す。誤操作を避けるため、押したあと確認を挟む。
export function UndoButton({ description }: { description: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(undoLastMoveAction, initialState);

  if (!confirming) {
    return (
      <div className="text-sm">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md px-2 py-1 text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          直前の操作を取り消す
        </button>
        {state.error && <p className="mt-1 text-danger">{state.error}</p>}
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => setConfirming(false)}
      className="rounded-lg border border-line bg-card p-3 text-sm"
    >
      <p>
        「{description}」の判定と配置を取り消します。取り消しは続けて1回までです。
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-danger px-3 py-1.5 font-bold text-white disabled:opacity-50"
        >
          取り消す
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
