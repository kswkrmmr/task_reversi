import Link from "next/link";
import { NoGamePanel } from "@/components/NoGamePanel";
import { Stone } from "@/components/ReversiBoard";
import { ShowMoreTasks } from "@/components/ShowMoreTasks";
import { TaskRows } from "@/components/TaskRows";
import { requireUserId } from "@/lib/auth/session";
import { getCurrentGame, listTasks, type TaskListItem } from "@/lib/game/service";
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
        <TaskList tasks={tasks} canJudge={game !== null} currentGameId={game?.id ?? null} />
      </section>
    </div>
  );
}

function TaskList({
  tasks,
  canJudge,
  currentGameId,
}: {
  tasks: TaskListItem[];
  canJudge: boolean;
  currentGameId: string | null;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-ink-soft">まだタスクがありません。「＋ 追加」から登録しましょう。</p>;
  }
  const now = new Date();
  const open = sortOpenTasks(tasks.filter((t) => t.category === "open"));
  const paused = tasks.filter((t) => t.category === "paused");
  // 判定済みは今のゲームで判定したものだけを新しい順に出す（前のゲームの分は履歴の結果画面で見られる）。
  const judged = tasks
    .filter((t) => t.category === "judged" && t.judgedGameId === currentGameId)
    .sort((a, b) => (b.judgedAt ?? "").localeCompare(a.judgedAt ?? ""));

  return (
    <div className="space-y-3">
      {open.length > 0 ? (
        <TaskRows tasks={open} canJudge={canJudge} now={now} />
      ) : (
        <p className="text-sm text-ink-soft">判定できるタスクはありません。</p>
      )}
      <Folded label="一時停止中のタスク" count={paused.length}>
        <TaskRows tasks={paused} canJudge={false} showReason={false} />
      </Folded>
      <Folded label="このゲームで判定済みのタスク" count={judged.length}>
        <ShowMoreTasks tasks={judged} />
      </Folded>
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

function Folded({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm text-ink-soft select-none [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span> {label}（{count}件）
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
