"use client";

import { useMemo, useState, useTransition } from "react";
import { ReversiBoard } from "@/components/ReversiBoard";
import { computeFlips, type Board, type Color, type Position } from "@/lib/reversi/board";
import type { ActionState } from "@/app/actions";

// 置けるマスを光らせ、マスの選択 → 反転のプレビュー → 確定 までを行う盤面。
// 判定と配置（PlayFlow）と、直前の石の置き直し（ReplaceFlow）で共用する。
export function PlacementPicker({
  board,
  color,
  placeable,
  idleHint,
  onConfirm,
}: {
  board: Board;
  color: Color;
  placeable: Position[];
  idleHint: string;
  // 成功時はサーバー側で画面遷移する。失敗時だけ error を返す。
  onConfirm: (pos: Position) => Promise<ActionState | undefined>;
}) {
  const [selected, setSelected] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const flips = useMemo(
    () => (selected ? computeFlips(board, selected, color) : []),
    [board, selected, color],
  );

  function confirm() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const state = await onConfirm(selected);
      if (state?.error) setError(state.error);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-ink-soft">
        {selected
          ? flips.length > 0
            ? `${flips.length}個の石が反転します`
            : "反転する石はありません"
          : idleHint}
      </p>

      <ReversiBoard
        board={board}
        placeable={placeable}
        placingColor={color}
        selected={selected}
        flips={flips}
        onSelect={pending ? undefined : setSelected}
      />

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={!selected || pending}
        className="w-full rounded-md bg-felt px-4 py-3 text-lg font-bold text-white hover:bg-felt-dark disabled:opacity-40"
      >
        {pending ? "保存中…" : selected ? "ここに置く" : "マスを選んでください"}
      </button>
    </div>
  );
}
