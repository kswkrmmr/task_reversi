"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/actions";
import { isoToJstLocalInput, type RecurrenceType } from "@/lib/game/rules";

const initialState: ActionState = { error: null };

export function TaskForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  // 編集時のみ渡す。一時停止の切り替えは編集時だけ表示する（一時停止中 = active が false）。
  defaults?: { title: string; recurrenceType: RecurrenceType; active: boolean; dueAt: string | null };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    defaults?.recurrenceType ?? "once",
  );
  const [due, setDue] = useState(defaults?.dueAt ? isoToJstLocalInput(defaults.dueAt) : "");

  return (
    <form action={formAction} className="space-y-5">
      <label className="block">
        <span className="text-sm font-bold">タスク名</span>
        <input
          name="title"
          required
          maxLength={100}
          defaultValue={defaults?.title}
          placeholder="例: READMEを修正する／毎日30分歩く"
          className="mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-base"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-bold">種類</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(
            [
              ["once", "単発", "1回だけ判定する"],
              ["daily", "毎日", "1日1回判定できる"],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col rounded-md border border-line bg-white px-3 py-2 has-[:checked]:border-felt has-[:checked]:ring-2 has-[:checked]:ring-felt/30"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="recurrenceType"
                  value={value}
                  checked={recurrenceType === value}
                  onChange={() => setRecurrenceType(value)}
                />
                <span className="font-bold">{label}</span>
              </span>
              <span className="text-xs text-ink-soft">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {recurrenceType === "once" && (
        <div>
          <label htmlFor="dueAt" className="text-sm font-bold">
            期限（任意）
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="dueAt"
              type="datetime-local"
              name="dueAt"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="block min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-base"
            />
            {due && (
              <button
                type="button"
                onClick={() => setDue("")}
                className="shrink-0 text-sm text-ink-soft underline underline-offset-2"
              >
                期限なしにする
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            期限までにやり終えたら「達成」、終わらなかったら「未達成」が目安です。
          </p>
        </div>
      )}

      {defaults && recurrenceType === "daily" && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="paused" defaultChecked={!defaults.active} />
          <span>一時停止中（判定の対象から外します。過去の記録は残ります）</span>
        </label>
      )}

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-felt px-4 py-2.5 font-bold text-white hover:bg-felt-dark disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
