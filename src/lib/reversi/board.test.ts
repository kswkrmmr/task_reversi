import { describe, expect, it } from "vitest";
import {
  applyMove,
  BOARD_SIZE,
  canPlace,
  computeFlips,
  countStones,
  createEmptyBoard,
  isFull,
  placeableCells,
  replay,
  type Board,
  type Color,
  type Position,
} from "./board";

// "W" = white, "B" = black, "." = empty の8行で盤面を作るテスト用ヘルパー
function parse(rows: string[]): Board {
  return rows.map((line) =>
    line.split("").map((ch) => (ch === "W" ? "white" : ch === "B" ? "black" : null)),
  );
}

function sortPositions(ps: Position[]): Position[] {
  return [...ps].sort((a, b) => a.row - b.row || a.col - b.col);
}

describe("createEmptyBoard", () => {
  it("8×8の空盤面を作る", () => {
    const board = createEmptyBoard();
    expect(board).toHaveLength(BOARD_SIZE);
    for (const row of board) {
      expect(row).toHaveLength(BOARD_SIZE);
      expect(row.every((c) => c === null)).toBe(true);
    }
  });
});

describe("computeFlips", () => {
  // 中央(3,3)に置いたとき、8方向それぞれで黒1枚を白で挟める盤面
  const surrounded = parse([
    ".W.W.W..",
    "..BBB...",
    ".WB.BW..",
    "..BBB...",
    ".W.W.W..",
    "........",
    "........",
    "........",
  ]);

  it("縦・横・斜めの8方向すべてで挟んだ石を反転する", () => {
    const flips = computeFlips(surrounded, { row: 2, col: 3 }, "white");
    expect(sortPositions(flips)).toEqual(
      sortPositions([
        { row: 1, col: 2 },
        { row: 1, col: 3 },
        { row: 1, col: 4 },
        { row: 2, col: 2 },
        { row: 2, col: 4 },
        { row: 3, col: 2 },
        { row: 3, col: 3 },
        { row: 3, col: 4 },
      ]),
    );
  });

  const directions: [string, Position, Position][] = [
    ["上", { row: -1, col: 0 }, { row: 1, col: 3 }],
    ["下", { row: 1, col: 0 }, { row: 3, col: 3 }],
    ["左", { row: 0, col: -1 }, { row: 2, col: 2 }],
    ["右", { row: 0, col: 1 }, { row: 2, col: 4 }],
    ["左上", { row: -1, col: -1 }, { row: 1, col: 2 }],
    ["右上", { row: -1, col: 1 }, { row: 1, col: 4 }],
    ["左下", { row: 1, col: -1 }, { row: 3, col: 2 }],
    ["右下", { row: 1, col: 1 }, { row: 3, col: 4 }],
  ];
  it.each(directions)("%s方向だけを単独で反転できる", (_name, d, expected) => {
    const board = createEmptyBoard();
    const origin = { row: 2, col: 3 };
    board[origin.row + d.row][origin.col + d.col] = "black";
    board[origin.row + 2 * d.row][origin.col + 2 * d.col] = "white";
    expect(computeFlips(board, origin, "white")).toEqual([expected]);
  });

  it("連続した複数枚をまとめて反転する", () => {
    const board = parse([
      "WBBBB...",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(sortPositions(computeFlips(board, { row: 0, col: 5 }, "white"))).toEqual([
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
    ]);
  });

  it("黒を置いたときは白を反転する", () => {
    const board = parse([
      "BW......",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(computeFlips(board, { row: 0, col: 2 }, "black")).toEqual([{ row: 0, col: 1 }]);
  });

  it("自分の色で閉じていない列（盤の端まで相手の石）は反転しない", () => {
    const board = parse([
      "BBB.....",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(computeFlips(board, { row: 0, col: 3 }, "white")).toEqual([]);
  });

  it("途中に空きマスがあれば反転しない", () => {
    const board = parse([
      "W.B.....",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(computeFlips(board, { row: 0, col: 3 }, "white")).toEqual([]);
  });

  it("隣が自分の色なら反転しない", () => {
    const board = parse([
      "WW......",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(computeFlips(board, { row: 0, col: 2 }, "white")).toEqual([]);
  });

  it("石があるマスでは反転を計算しない", () => {
    expect(computeFlips(surrounded, { row: 1, col: 3 }, "white")).toEqual([]);
  });
});

describe("placeableCells / canPlace", () => {
  it("1手目は64マスどこでも置ける", () => {
    const board = createEmptyBoard();
    expect(placeableCells(board, "white")).toHaveLength(64);
    expect(canPlace(board, { row: 7, col: 7 }, "black")).toBe(true);
  });

  it("反転できるマスがあれば、そのマスだけが置ける", () => {
    const board = parse([
      "........",
      "........",
      "...WB...",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(placeableCells(board, "white")).toEqual([{ row: 2, col: 5 }]);
    // 隣接していても反転できないマスには置けない
    expect(canPlace(board, { row: 1, col: 3 }, "white")).toBe(false);
  });

  it("反転できるマスがなければ、既存の石に8方向で隣接する空きマスに置ける", () => {
    const board = parse([
      "........",
      "........",
      "...W....",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(placeableCells(board, "black")).toEqual([
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
      { row: 2, col: 2 },
      { row: 2, col: 4 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
      { row: 3, col: 4 },
    ]);
    // 離れたマスには置けない
    expect(canPlace(board, { row: 5, col: 5 }, "black")).toBe(false);
  });

  it("石があるマスには置けない", () => {
    const board = parse([
      "W.......",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(canPlace(board, { row: 0, col: 0 }, "black")).toBe(false);
  });

  it("盤外の座標には置けない", () => {
    const board = createEmptyBoard();
    expect(canPlace(board, { row: -1, col: 0 }, "white")).toBe(false);
    expect(canPlace(board, { row: 0, col: 8 }, "white")).toBe(false);
  });

  it("盤面が埋まっていれば置けるマスはない", () => {
    const full = parse(Array(8).fill("WBWBWBWB"));
    expect(placeableCells(full, "white")).toEqual([]);
  });
});

describe("applyMove", () => {
  it("石を置いて反転し、元の盤面は変更しない", () => {
    const board = parse([
      "WB......",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    const { board: next, flipped } = applyMove(board, { row: 0, col: 2 }, "white");
    expect(next[0].slice(0, 3)).toEqual(["white", "white", "white"]);
    expect(flipped).toEqual([{ row: 0, col: 1 }]);
    expect(board[0][1]).toBe("black");
    expect(board[0][2]).toBeNull();
  });

  it("反転できない場所でも置いた石は残る", () => {
    const board = parse([
      "B.......",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    const { board: next, flipped } = applyMove(board, { row: 1, col: 1 }, "white");
    expect(flipped).toEqual([]);
    expect(next[1][1]).toBe("white");
    expect(next[0][0]).toBe("black");
  });

  it("置けないマスへの配置はエラーにする", () => {
    const board = parse([
      "W.......",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(() => applyMove(board, { row: 0, col: 0 }, "black")).toThrow();
    expect(() => applyMove(board, { row: 5, col: 5 }, "black")).toThrow();
  });
});

describe("replay", () => {
  it("配置履歴を順に再生して反転込みの盤面を再構築する", () => {
    const moves: { row: number; col: number; color: Color }[] = [
      { row: 0, col: 0, color: "white" },
      { row: 0, col: 1, color: "black" },
      { row: 0, col: 2, color: "white" }, // (0,1) を白に反転
      { row: 1, col: 1, color: "black" },
    ];
    const board = replay(moves);
    expect(board[0].slice(0, 3)).toEqual(["white", "white", "white"]);
    expect(board[1][1]).toBe("black");
    expect(countStones(board)).toEqual({ white: 3, black: 1, empty: 60 });
  });

  it("空の履歴なら空盤面", () => {
    expect(replay([])).toEqual(createEmptyBoard());
  });

  it("ルール違反の履歴はエラーにする", () => {
    expect(() =>
      replay([
        { row: 0, col: 0, color: "white" },
        { row: 7, col: 7, color: "black" },
      ]),
    ).toThrow();
  });
});

describe("countStones / isFull", () => {
  it("白・黒・空きを数える", () => {
    const board = parse([
      "WWB.....",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(countStones(board)).toEqual({ white: 2, black: 1, empty: 61 });
    expect(isFull(board)).toBe(false);
  });

  it("64マス埋まると満杯", () => {
    expect(isFull(parse(Array(8).fill("WBWBWBWB")))).toBe(true);
  });

  it("ルールに従って64手置くと必ず満杯になる（途中で詰まらない）", () => {
    let board = createEmptyBoard();
    for (let i = 0; i < 64; i++) {
      const color: Color = i % 3 === 0 ? "black" : "white";
      const cells = placeableCells(board, color);
      expect(cells.length).toBeGreaterThan(0);
      board = applyMove(board, cells[(i * 7) % cells.length], color).board;
    }
    expect(isFull(board)).toBe(true);
  });
});
