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
  if (!task.active) {
    return { ok: false, error: "無効なタスクは判定できません" };
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
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function getJstTodayString(): string {
  return toJstDateString(new Date());
}
