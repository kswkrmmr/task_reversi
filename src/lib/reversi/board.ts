// 「タスクでリバーシ」の盤面ロジック。UI・DBに依存しない純粋関数のみを置く。
// 盤面はDBに保存せず、配置履歴を replay して毎回再構築する。

export const BOARD_SIZE = 8;

export type Color = "white" | "black";
export type Cell = Color | null;
export type Board = Cell[][];
export type Position = { row: number; col: number };
export type Move = Position & { color: Color };

const DIRECTIONS: readonly Position[] = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(null));
}

function inBounds({ row, col }: Position): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function opposite(color: Color): Color {
  return color === "white" ? "black" : "white";
}

// pos に color を置いたとき、8方向で挟んで反転する相手の石の位置を返す。
export function computeFlips(board: Board, pos: Position, color: Color): Position[] {
  if (!inBounds(pos) || board[pos.row][pos.col] !== null) return [];

  const flips: Position[] = [];
  for (const d of DIRECTIONS) {
    const line: Position[] = [];
    let cur = { row: pos.row + d.row, col: pos.col + d.col };
    while (inBounds(cur) && board[cur.row][cur.col] === opposite(color)) {
      line.push(cur);
      cur = { row: cur.row + d.row, col: cur.col + d.col };
    }
    if (line.length > 0 && inBounds(cur) && board[cur.row][cur.col] === color) {
      flips.push(...line);
    }
  }
  return flips;
}

function hasNeighborStone(board: Board, pos: Position): boolean {
  return DIRECTIONS.some((d) => {
    const n = { row: pos.row + d.row, col: pos.col + d.col };
    return inBounds(n) && board[n.row][n.col] !== null;
  });
}

function emptyCells(board: Board): Position[] {
  const cells: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === null) cells.push({ row, col });
    }
  }
  return cells;
}

// 配置ルール:
// 1. 盤面が空なら（1手目）どこでも置ける。
// 2. 反転できるマスがあれば、その中からのみ選べる。
// 3. 反転できるマスがなければ、既存の石に8方向で隣接する空きマスに置ける。
// 盤面に石があり空きマスもあれば、3 の候補は必ず1つ以上存在するため詰まらない。
export function placeableCells(board: Board, color: Color): Position[] {
  const empties = emptyCells(board);
  if (empties.length === BOARD_SIZE * BOARD_SIZE) return empties;

  const flipping = empties.filter((p) => computeFlips(board, p, color).length > 0);
  if (flipping.length > 0) return flipping;

  return empties.filter((p) => hasNeighborStone(board, p));
}

export function canPlace(board: Board, pos: Position, color: Color): boolean {
  return placeableCells(board, color).some((p) => p.row === pos.row && p.col === pos.col);
}

export function applyMove(
  board: Board,
  pos: Position,
  color: Color,
): { board: Board; flipped: Position[] } {
  if (!canPlace(board, pos, color)) {
    throw new Error(`(${pos.row}, ${pos.col}) には ${color} を置けません`);
  }
  const flipped = computeFlips(board, pos, color);
  const next = board.map((row) => [...row]);
  next[pos.row][pos.col] = color;
  for (const f of flipped) next[f.row][f.col] = color;
  return { board: next, flipped };
}

export function replay(moves: readonly Move[]): Board {
  return moves.reduce((board, m) => applyMove(board, m, m.color).board, createEmptyBoard());
}

export function countStones(board: Board): { white: number; black: number; empty: number } {
  const counts = { white: 0, black: 0, empty: 0 };
  for (const row of board) {
    for (const cell of row) {
      if (cell === null) counts.empty++;
      else counts[cell]++;
    }
  }
  return counts;
}

export function isFull(board: Board): boolean {
  return countStones(board).empty === 0;
}
