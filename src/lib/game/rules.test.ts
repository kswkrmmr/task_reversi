import { describe, expect, it } from "vitest";
import { createEmptyBoard } from "@/lib/reversi/board";
import {
  canUndo,
  checkCanJudge,
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

  it("無効なタスクは判定できない", () => {
    expect(checkCanJudge({ recurrenceType: "daily", active: false }, [], today).ok).toBe(false);
  });
});

describe("canUndo", () => {
  it("進行中で配置があり、直前に取り消していなければ取り消せる", () => {
    expect(canUndo({ status: "in_progress", undoUsed: false }, 3)).toBe(true);
  });

  it("配置が1つもなければ取り消せない", () => {
    expect(canUndo({ status: "in_progress", undoUsed: false }, 0)).toBe(false);
  });

  it("取り消しは連続1回まで", () => {
    expect(canUndo({ status: "in_progress", undoUsed: true }, 3)).toBe(false);
  });

  it("終了したゲームは取り消せない", () => {
    expect(canUndo({ status: "finished", undoUsed: false }, 64)).toBe(false);
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
