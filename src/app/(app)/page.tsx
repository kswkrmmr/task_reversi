import Link from "next/link";
import { startNewGameAction } from "@/app/actions";
import { ReversiBoard, StoneCounts } from "@/components/ReversiBoard";
import { ReplaceLink } from "@/components/ReplaceLink";
import { requireUserId } from "@/lib/auth/session";
import { getCurrentGame, listFinishedGames, listTasks, type TaskListItem } from "@/lib/game/service";
import { describeDue } from "@/lib/game/rules";
import { BOARD_SIZE } from "@/lib/reversi/board";

const TOTAL = BOARD_SIZE * BOARD_SIZE;

export default async function HomePage() {
  const userId = await requireUserId();
  const [game, tasks] = await Promise.all([getCurrentGame(userId), listTasks(userId)]);

  return (
    <div className="space-y-8">
      {game ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h1 className="text-lg font-bold">現在のゲーム</h1>
            <p className="text-sm text-ink-soft">
              {game.moves.length} / {TOTAL} 手
            </p>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={game.moves.length}
            aria-valuemax={TOTAL}
            aria-label="ゲームの進行状況"
          >
            <div className="h-full bg-felt" style={{ width: `${(game.moves.length / TOTAL) * 100}%` }} />
          </div>
          <ReversiBoard board={game.board} lastMove={game.lastMove} />
          <StoneCounts
            white={game.summary.white}
            black={game.summary.black}
            empty={TOTAL - game.moves.length}
          />
          {game.lastMove && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
              <p>
                直前: 「{game.lastMove.taskTitle}」
                {game.lastMove.result === "achieved" ? "達成（白）" : "未達成（黒）"}
              </p>
              {game.canReplaceLastMove && <ReplaceLink />}
            </div>
          )}
        </section>
      ) : (
        <NoGame userId={userId} />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">タスク</h2>
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

async function NoGame({ userId }: { userId: string }) {
  const [latest] = await listFinishedGames(userId);
  return (
    <section className="space-y-3 rounded-lg border border-line bg-card p-5 text-center">
      <p className="font-bold">{latest ? "ゲームが終了しました" : "ようこそ！"}</p>
      <p className="text-sm text-ink-soft">
        {latest
          ? "新しいゲームを始めると、空の盤面からスタートします。タスクは引き継がれます。"
          : "タスクを登録して、ゲームを始めましょう。"}
      </p>
      <form action={startNewGameAction}>
        <button
          type="submit"
          className="rounded-md bg-felt px-5 py-2.5 font-bold text-white hover:bg-felt-dark"
        >
          新しいゲームを始める
        </button>
      </form>
      {latest && (
        <Link href={`/games/${latest.id}`} className="inline-block text-sm underline underline-offset-2">
          前回の結果を見る
        </Link>
      )}
    </section>
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
