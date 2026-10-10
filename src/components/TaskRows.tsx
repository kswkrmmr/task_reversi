import Link from "next/link";
import { describeDue } from "@/lib/game/rules";
import type { TaskListItem } from "@/lib/game/service";

// タスク一覧の行。フックを持たないので、サーバー・クライアントどちらのコンポーネントからも使える。
export function TaskRows({
  tasks,
  canJudge,
  now,
  showReason = true,
}: {
  tasks: TaskListItem[];
  canJudge: boolean;
  // 期限の表示に使う現在時刻。期限を表示しない一覧（判定済みなど）では省略できる。
  now?: Date;
  showReason?: boolean;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
      {tasks.map((t) => {
        const due = now && t.dueAt && t.category === "open" ? describeDue(t.dueAt, now) : null;
        return (
          <li key={t.id} className={`flex items-center gap-3 px-4 py-3 ${t.judgeable ? "" : "text-ink-soft"}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{t.title}</p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="rounded bg-paper px-1.5 py-0.5">
                  {t.recurrenceType === "once" ? "単発" : "毎日"}
                </span>
                {due && (
                  <span className={due.overdue ? "font-bold text-danger" : ""}>{due.label}</span>
                )}
                {t.result && (
                  <span className={t.result === "achieved" ? "font-bold text-felt" : ""}>
                    {t.result === "achieved" ? "達成" : "未達成"}
                  </span>
                )}
                {showReason && t.reason && <span>{t.reason}</span>}
              </p>
            </div>
            <Link
              href={`/tasks/${t.id}/edit`}
              className="shrink-0 text-sm text-ink-soft underline underline-offset-2"
            >
              編集
            </Link>
            {t.judgeable && canJudge && (
              <Link
                href={`/play/${t.id}`}
                className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-bold text-white hover:opacity-90"
              >
                判定する
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
