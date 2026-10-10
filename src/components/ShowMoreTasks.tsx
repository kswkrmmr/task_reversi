"use client";

import { useState } from "react";
import { TaskRows } from "@/components/TaskRows";
import type { TaskListItem } from "@/lib/game/service";

// 最初は step 件だけ表示し、「もっと見る」で step 件ずつ増やす。
export function ShowMoreTasks({ tasks, step = 10 }: { tasks: TaskListItem[]; step?: number }) {
  const [count, setCount] = useState(step);
  const rest = tasks.length - count;

  return (
    <div className="space-y-2">
      <TaskRows tasks={tasks.slice(0, count)} canJudge={false} showReason={false} />
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setCount((c) => c + step)}
          className="w-full rounded-md border border-line bg-card py-2 text-sm text-ink-soft hover:text-ink"
        >
          もっと見る（残り{rest}件）
        </button>
      )}
    </div>
  );
}
