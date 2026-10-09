import type { Board, Color, Position } from "@/lib/reversi/board";

const COLS = "ABCDEFGH";

function key(p: Position) {
  return `${p.row}-${p.col}`;
}

export function Stone({ color, className = "" }: { color: Color; className?: string }) {
  return (
    <span
      aria-hidden
      className={`block rounded-full ${color === "white" ? "stone-white" : "stone-black"} ${className}`}
    />
  );
}

// 盤面の表示。onSelect を渡すと、placeable のマスがタップ可能なボタンになる。
// サーバー・クライアントのどちらのコンポーネントからも使える（フックを持たない）。
export function ReversiBoard({
  board,
  placeable = [],
  placingColor,
  selected = null,
  flips = [],
  lastMove = null,
  onSelect,
  className = "",
}: {
  board: Board;
  placeable?: Position[];
  placingColor?: Color;
  selected?: Position | null;
  flips?: Position[];
  lastMove?: Position | null;
  onSelect?: (p: Position) => void;
  className?: string;
}) {
  const placeableKeys = new Set(placeable.map(key));
  const flipKeys = new Set(flips.map(key));

  return (
    <div
      role="grid"
      aria-label="盤面"
      className={`grid aspect-square w-full grid-cols-8 gap-px rounded-lg border-4 border-felt-dark bg-felt-dark p-px shadow-md ${className}`}
    >
      {board.map((row, r) =>
        row.map((cell, c) => {
          const pos = { row: r, col: c };
          const k = key(pos);
          const label = `${COLS[c]}${r + 1}`;
          const isSelected = selected?.row === r && selected?.col === c;
          const isPlaceable = placeableKeys.has(k);
          const willFlip = flipKeys.has(k);
          const isLast = lastMove?.row === r && lastMove?.col === c;
          const shownColor: Color | null = isSelected
            ? (placingColor ?? null)
            : willFlip && placingColor
              ? placingColor
              : cell;

          const content = (
            <>
              {shownColor && (
                <Stone
                  color={shownColor}
                  className={`h-[82%] w-[82%] ${isSelected || willFlip ? "stone-drop" : ""} ${
                    willFlip ? "ring-2 ring-accent" : ""
                  }`}
                />
              )}
              {!shownColor && isPlaceable && (
                <span
                  aria-hidden
                  className={`hint-pulse block h-[34%] w-[34%] rounded-full ${
                    placingColor === "black" ? "bg-black/60" : "bg-white/80"
                  }`}
                />
              )}
              {isLast && !isSelected && (
                <span aria-hidden className="absolute h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </>
          );

          const base = `relative flex items-center justify-center bg-felt ${
            isSelected ? "outline outline-3 -outline-offset-3 outline-accent" : ""
          }`;

          if (onSelect && isPlaceable) {
            return (
              <button
                key={k}
                type="button"
                role="gridcell"
                aria-label={`${label}に置く`}
                aria-selected={isSelected}
                onClick={() => onSelect(pos)}
                className={`${base} cursor-pointer hover:bg-[#3a8c5d] focus-visible:z-10 focus-visible:outline focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-white`}
              >
                {content}
              </button>
            );
          }
          return (
            <div
              key={k}
              role="gridcell"
              aria-label={`${label} ${cell === "white" ? "白" : cell === "black" ? "黒" : "空き"}`}
              className={base}
            >
              {content}
            </div>
          );
        }),
      )}
    </div>
  );
}

export function StoneCounts({
  white,
  black,
  empty,
}: {
  white: number;
  black: number;
  empty?: number;
}) {
  return (
    <dl className="flex items-center justify-center gap-5 text-sm">
      <div className="flex items-center gap-1.5">
        <Stone color="white" className="h-5 w-5" />
        <dt className="sr-only">白石</dt>
        <dd className="text-lg font-bold tabular-nums">{white}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <Stone color="black" className="h-5 w-5" />
        <dt className="sr-only">黒石</dt>
        <dd className="text-lg font-bold tabular-nums">{black}</dd>
      </div>
      {empty !== undefined && (
        <div className="flex items-center gap-1.5 text-ink-soft">
          <dt>空き</dt>
          <dd className="text-lg font-bold tabular-nums">{empty}</dd>
        </div>
      )}
    </dl>
  );
}
