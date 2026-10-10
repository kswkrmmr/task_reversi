"use client";

import { useMemo } from "react";
import Link from "next/link";
import { replaceLastMoveAction } from "@/app/actions";
import { PlacementPicker } from "@/components/PlacementPicker";
import { Stone } from "@/components/ReversiBoard";
import { placeableCells, replay, type Move } from "@/lib/reversi/board";

// 直前の石を置き直す。判定（石の色）はそのままで、その石を置く前の盤面から置き場所だけを選び直す。
// 確定するまでは何も保存しないので、途中で画面を離れれば元の石はそのまま残る。
export function ReplaceFlow({ moves, taskTitle }: { moves: Move[]; taskTitle: string }) {
  const last = moves.at(-1)!;
  const board = useMemo(() => replay(moves.slice(0, -1)), [moves]);
  // 元と同じマスは選べないようにする（置き直しの1回を無駄にしないため）。
  const placeable = useMemo(
    () => placeableCells(board, last.color).filter((p) => p.row !== last.row || p.col !== last.col),
    [board, last],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-card p-4">
        <p className="text-xs text-ink-soft">置き直す石</p>
        <p className="flex items-center gap-2 text-lg font-bold">
          <Stone color={last.color} className="h-7 w-7" />
          {taskTitle}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          「{taskTitle}」の石を置き直します。判定はそのままです。置き直しは1手のみです。
        </p>
      </div>

      {placeable.length > 0 ? (
        <PlacementPicker
          board={board}
          color={last.color}
          placeable={placeable}
          idleHint="光っているマスから新しい置き場所を選んでください"
          onConfirm={(pos) => replaceLastMoveAction(pos)}
        />
      ) : (
        <p className="text-center text-sm text-ink-soft">
          ルール上、この石はほかのマスに置けないため置き直せません。
        </p>
      )}

      <p className="text-center text-sm">
        <Link href="/" className="text-ink-soft underline underline-offset-2">
          やめる（元の位置のまま）
        </Link>
      </p>
    </div>
  );
}
