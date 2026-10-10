import { describe, expect, it } from "vitest";
import { createEmptyBoard } from "@/lib/reversi/board";
import {
  canReplaceLastMove,
  checkCanJudge,
  describeDue,
  isoToJstLocalInput,
  jstLocalInputToIso,
  judgeGuide,
  stoneColorFor,
  summarizeGame,
  toJstDateString,
} from "./rules";

describe("stoneColorFor", () => {
  it("達成なら白石、未達成なら黒石", () => {
    expect(stoneColorFor("achieved")).toBe("white");
    expect(stoneColorFor("missed")).toBe("black");
  });
});

describe("checkCanJudge", () => {
  const today = "2026-10-09";

  it("未判定の単発タスクは判定できる", () => {
    expect(checkCanJudge({ recurrenceType: "once", active: true }, [], today)).toEqual({ ok: true });
  });

  it("判定済みの単発タスクは、別の日・別のゲームでも再判定できない", () => {
    const result = checkCanJudge(
      { recurrenceType: "once", active: true },
      [{ attemptedOn: "2026-09-01" }],
      today,
    );
    expect(result.ok).toBe(false);
  });

  it("繰り返しタスクは別の日なら何度でも判定できる", () => {
    expect(
      checkCanJudge(
        { recurrenceType: "daily", active: true },
        [{ attemptedOn: "2026-10-07" }, { attemptedOn: "2026-10-08" }],
        today,
      ),
    ).toEqual({ ok: true });
  });

  it("繰り返しタスクは同じ日に2回判定できない", () => {
    const result = checkCanJudge(
      { recurrenceType: "daily", active: true },
      [{ attemptedOn: today }],
      today,
    );
    expect(result.ok).toBe(false);
  });

  it("一時停止中のタスクは判定できない", () => {
    expect(checkCanJudge({ recurrenceType: "daily", active: false }, [], today).ok).toBe(false);
  });

  it("単発タスクは一時停止しないので、active が false でも判定できる（旧データ対策）", () => {
    expect(checkCanJudge({ recurrenceType: "once", active: false }, [], today)).toEqual({ ok: true });
  });
});

describe("canReplaceLastMove", () => {
  it("進行中で配置があり、直前の手をまだ置き直していなければ置き直せる", () => {
    expect(canReplaceLastMove({ status: "in_progress", undoUsed: false }, 3)).toBe(true);
  });

  it("配置が1つもなければ置き直せない", () => {
    expect(canReplaceLastMove({ status: "in_progress", undoUsed: false }, 0)).toBe(false);
  });

  it("置き直しは1手につき1回まで", () => {
    expect(canReplaceLastMove({ status: "in_progress", undoUsed: true }, 3)).toBe(false);
  });

  it("終了したゲームは置き直せない", () => {
    expect(canReplaceLastMove({ status: "finished", undoUsed: false }, 64)).toBe(false);
  });
});

describe("summarizeGame", () => {
  it("判定回数と盤面の石数を別々に集計し、達成率を出す", () => {
    const board = createEmptyBoard();
    board[0][0] = "white";
    board[0][1] = "white";
    board[0][2] = "black";
    const summary = summarizeGame(["achieved", "achieved", "missed", "achieved"], board);
    expect(summary).toEqual({
      achieved: 3,
      missed: 1,
      judged: 4,
      achievementRate: 75,
      white: 2,
      black: 1,
    });
  });

  it("判定済みタスクが0件なら達成率は0%", () => {
    expect(summarizeGame([], createEmptyBoard()).achievementRate).toBe(0);
  });

  it("達成率は小数点以下を四捨五入した整数", () => {
    expect(summarizeGame(["achieved", "missed", "missed"], createEmptyBoard()).achievementRate).toBe(33);
    expect(summarizeGame(["achieved", "achieved", "missed"], createEmptyBoard()).achievementRate).toBe(67);
  });
});

describe("toJstDateString", () => {
  it("UTCの日時をJSTの暦日に変換する", () => {
    expect(toJstDateString(new Date("2026-10-08T14:59:59Z"))).toBe("2026-10-08");
    expect(toJstDateString(new Date("2026-10-08T15:00:00Z"))).toBe("2026-10-09");
  });
});

describe("describeDue", () => {
  const due = "2026-10-12T09:00:00.000Z"; // JST 10/12(月) 18:00

  it("期限前は日本時間の日時を「〜まで」で表示する", () => {
    expect(describeDue(due, new Date("2026-10-10T00:00:00Z"))).toEqual({
      overdue: false,
      label: "10/12(月) 18:00まで",
    });
  });

  it("期限を過ぎたら超過時間を表示する（日・時間・分）", () => {
    expect(describeDue(due, new Date("2026-10-14T10:00:00Z"))).toEqual({
      overdue: true,
      label: "期限切れ（2日超過）",
    });
    expect(describeDue(due, new Date("2026-10-12T14:30:00Z")).label).toBe("期限切れ（5時間超過）");
    expect(describeDue(due, new Date("2026-10-12T09:20:00Z")).label).toBe("期限切れ（20分超過）");
  });

  it("期限ちょうどはまだ期限内", () => {
    expect(describeDue(due, new Date(due)).overdue).toBe(false);
  });
});

describe("JST の日時入力との変換", () => {
  it("datetime-local の値を日本時間として ISO に変換する", () => {
    expect(jstLocalInputToIso("2026-10-12T18:00")).toBe("2026-10-12T09:00:00.000Z");
  });

  it("ISO を日本時間の datetime-local の値に変換する", () => {
    expect(isoToJstLocalInput("2026-10-12T09:00:00.000Z")).toBe("2026-10-12T18:00");
  });

  it("不正な値は null", () => {
    expect(jstLocalInputToIso("")).toBeNull();
    expect(jstLocalInputToIso("2026-13-40T99:00")).toBeNull();
    expect(jstLocalInputToIso("abc")).toBeNull();
  });
});

describe("judgeGuide", () => {
  it("毎日タスクは今日やったかどうか", () => {
    expect(judgeGuide({ recurrenceType: "daily", dueAt: null })).toEqual({
      achieved: "今日やった",
      missed: "今日はできなかった",
    });
  });

  it("期限ありの単発タスクは期限までに終えたかどうか", () => {
    expect(judgeGuide({ recurrenceType: "once", dueAt: "2026-10-12T09:00:00.000Z" })).toEqual({
      achieved: "期限までにやり終えた",
      missed: "期限までに終わらなかった・やめることにした",
    });
  });

  it("期限なしの単発タスクはやり終えたかどうか", () => {
    expect(judgeGuide({ recurrenceType: "once", dueAt: null })).toEqual({
      achieved: "やり終えた",
      missed: "やめることにした",
    });
  });
});
