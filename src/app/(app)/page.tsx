import Link from "next/link";
import { NoGamePanel } from "@/components/NoGamePanel";
import { Stone } from "@/components/ReversiBoard";
import { requireUserId } from "@/lib/auth/session";
import { getCurrentGame, listTasks, type TaskListItem } from "@/lib/game/service";
import { describeDue } from "@/lib/game/rules";
import { BOARD_SIZE } from "@/lib/reversi/board";

const TOTAL = BOARD_SIZE * BOARD_SIZE;

// タスクタブ（ホーム）。盤面は「盤面」タブに分け、ここでは1行の要約だけを出す。
export default async function TasksPage() {
  const userId = await requireUserId();
  const [game, tasks] = await Promise.all([getCurrentGame(userId), listTasks(userId)]);

  return (
    <div className="space-y-5">
      {game ? (
        <Link
          href="/board"
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-4 py-3 text-sm hover:border-felt"
        >
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Stone color="white" className="h-4 w-4" />
              <span className="font-bold tabular-nums">{game.summary.white}</span>
            </span>
            <span className="flex items-center gap-1">
              <Stone color="black" className="h-4 w-4" />
              <span className="font-bold tabular-nums">{game.summary.black}</span>
            </span>
            <span className="text-ink-soft">
              {game.moves.length} / {TOTAL} 手
            </span>
          </span>
          <span className="text-ink-soft">盤面を見る ›</span>
        </Link>
      ) : (
        <NoGamePanel userId={userId} />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">タスク</h1>
          <Link
            href="/tasks/new"
            className="rounded-md bg-felt px-3 py-1.5 text-sm font-bold text-white hover:bg-felt-dark"
          >
            ＋ 追加
          </Link>
        </div>
        <TaskList tasks={tasks} canJudge={game !== null} />
      </section>
    </div>
  );
}

function TaskList({ tasks, canJudge }: { tasks: TaskListItem[]; canJudge: boolean }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-ink-soft">まだタスクがありません。「＋ 追加」から登録しましょう。</p>;
  }
  const now = new Date();
  const open = sortOpenTasks(tasks.filter((t) => t.category === "open"));
  const paused = tasks.filter((t) => t.category === "paused");
  const judged = tasks.filter((t) => t.category === "judged");

  return (
    <div className="space-y-3">
      {open.length > 0 ? (
        <TaskRows tasks={open} canJudge={canJudge} now={now} />
      ) : (
        <p className="text-sm text-ink-soft">判定できるタスクはありません。</p>
      )}
      <FoldedTasks label="一時停止中のタスク" tasks={paused} now={now} />
      <FoldedTasks label="判定済みのタスク" tasks={judged} now={now} />
    </div>
  );
}

// 期限のあるタスクを期限が近い順（期限切れが先頭）に、期限のないタスクはその後ろに並べる。
// 期限のないタスク同士は、判定できるものを先にする。
function sortOpenTasks(tasks: TaskListItem[]): TaskListItem[] {
  return [...tasks].sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return Number(b.judgeable) - Number(a.judgeable);
  });
}

function FoldedTasks({ label, tasks, now }: { label: string; tasks: TaskListItem[]; now: Date }) {
  if (tasks.length === 0) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm text-ink-soft select-none [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span> {label}（
        {tasks.length}件）
      </summary>
      <div className="mt-2">
        <TaskRows tasks={tasks} canJudge={false} now={now} showReason={false} />
      </div>
    </details>
  );
}

function TaskRows({
  tasks,
  canJudge,
  now,
  showReason = true,
}: {
  tasks: TaskListItem[];
  canJudge: boolean;
  now: Date;
  showReason?: boolean;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
      {tasks.map((t) => {
        const due = t.dueAt && t.category === "open" ? describeDue(t.dueAt, now) : null;
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
