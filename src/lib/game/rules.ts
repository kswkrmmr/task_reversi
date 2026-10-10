// タスク判定・取り消し・集計のルール。DBに依存しない純粋関数のみを置く。
import { countStones, type Board, type Color } from "@/lib/reversi/board";

export type AttemptResult = "achieved" | "missed";
export type RecurrenceType = "once" | "daily";
export type GameStatus = "in_progress" | "finished";

export function stoneColorFor(result: AttemptResult): Color {
  return result === "achieved" ? "white" : "black";
}

export type JudgeCheck = { ok: true } | { ok: false; error: string };

// 単発タスクはゲームをまたいで生涯1回、繰り返しタスクはJSTの1日につき1回まで判定できる。
export function checkCanJudge(
  task: { recurrenceType: RecurrenceType; active: boolean },
  pastAttempts: readonly { attemptedOn: string }[],
  today: string,
): JudgeCheck {
  // 一時停止は毎日タスクだけの機能。単発タスクの active は無視する。
  if (task.recurrenceType === "daily" && !task.active) {
    return { ok: false, error: "一時停止中のタスクは判定できません" };
  }
  if (task.recurrenceType === "once" && pastAttempts.length > 0) {
    return { ok: false, error: "このタスクはすでに判定済みです" };
  }
  if (task.recurrenceType === "daily" && pastAttempts.some((a) => a.attemptedOn === today)) {
    return { ok: false, error: "このタスクは今日すでに判定済みです" };
  }
  return { ok: true };
}

// 置き直しは直前の1手だけ・1手につき1回まで（判定はそのまま、石の位置だけを変える）。
// Game.undoUsed は「直前の手を置き直し済みか」を表す（列名は初期実装の名残）。
export function canReplaceLastMove(
  game: { status: GameStatus; undoUsed: boolean },
  placementCount: number,
): boolean {
  return game.status === "in_progress" && !game.undoUsed && placementCount > 0;
}

export type GameSummary = {
  achieved: number;
  missed: number;
  judged: number;
  achievementRate: number;
  white: number;
  black: number;
};

// 判定回数と盤面の石数は別々に集計する（反転があるため両者は一致しない）。
export function summarizeGame(results: readonly AttemptResult[], board: Board): GameSummary {
  const achieved = results.filter((r) => r === "achieved").length;
  const judged = results.length;
  const { white, black } = countStones(board);
  return {
    achieved,
    missed: judged - achieved,
    judged,
    achievementRate: judged === 0 ? 0 : Math.round((achieved / judged) * 100),
    white,
    black,
  };
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toJstDateString(date: Date): string {
  return toJstIso(date).slice(0, 10);
}

export function getJstTodayString(): string {
  return toJstDateString(new Date());
}

// ---------- 単発タスクの期限 ----------

const dueFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function describeDue(dueAt: string, now: Date): { overdue: boolean; label: string } {
  const due = new Date(dueAt);
  const diffMs = now.getTime() - due.getTime();
  if (diffMs <= 0) {
    const parts = Object.fromEntries(dueFormatter.formatToParts(due).map((p) => [p.type, p.value]));
    return {
      overdue: false,
      label: `${parts.month}/${parts.day}(${parts.weekday}) ${parts.hour}:${parts.minute}まで`,
    };
  }
  const minutes = Math.floor(diffMs / 60000);
  const amount =
    minutes >= 1440
      ? `${Math.floor(minutes / 1440)}日`
      : minutes >= 60
        ? `${Math.floor(minutes / 60)}時間`
        : `${Math.max(minutes, 1)}分`;
  return { overdue: true, label: `期限切れ（${amount}超過）` };
}

// <input type="datetime-local"> の値（"YYYY-MM-DDTHH:mm"）を日本時間として解釈し ISO 文字列にする。
export function jstLocalInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d, h - 9, mi);
  // 存在しない日時（2月30日など）は Date が繰り上げてしまうので、往復して一致するかで弾く。
  if (isoToJstLocalInput(new Date(utc).toISOString()) !== value) return null;
  return new Date(utc).toISOString();
}

export function isoToJstLocalInput(iso: string): string {
  return toJstIso(new Date(iso)).slice(0, 16);
}

function toJstIso(date: Date): string {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString();
}

// ---------- 判定の目安 ----------

// 判定画面に出す「達成」「未達成」の選び方の目安（改行区切りで複数行）。最終的な判断はユーザーに任せる。
export function judgeGuide(task: { recurrenceType: RecurrenceType; dueAt: string | null }): {
  achieved: string;
  missed: string;
} {
  if (task.recurrenceType === "daily") {
    return { achieved: "今日やった", missed: "今日はできなかった" };
  }
  if (task.dueAt) {
    return {
      achieved: "期日を守ってタスク完了",
      missed: "あきらめた\nタスク完了したけど期日過ぎた",
    };
  }
  return { achieved: "タスク完了", missed: "あきらめた" };
}
