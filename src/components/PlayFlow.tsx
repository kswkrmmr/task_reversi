"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { submitMoveAction } from "@/app/actions";
import { ReversiBoard, Stone } from "@/components/ReversiBoard";
import { stoneColorFor, type AttemptResult } from "@/lib/game/rules";
import { computeFlips, placeableCells, replay, type Move, type Position } from "@/lib/reversi/board";

// タスク判定 → 石の獲得 → 配置 → 確定 までを1画面で行う。
// 判定結果はこの画面の状態として持つだけで、配置を確定したときに判定と配置をまとめて保存する。
export function PlayFlow({
  taskId,
  taskTitle,
  moves,
  lastMove,
}: {
  taskId: string;
  taskTitle: string;
  moves: Move[];
  lastMove: Position | null;
}) {
  const board = useMemo(() => replay(moves), [moves]);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [selected, setSelected] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const color = result ? stoneColorFor(result) : null;
  const placeable = useMemo(() => (color ? placeableCells(board, color) : []), [board, color]);
  const flips = selected && color ? computeFlips(board, selected, color) : [];

  function choose(r: AttemptResult) {
    setResult(r);
    setSelected(null);
    setError(null);
  }

  function confirm() {
    if (!result || !selected) return;
    setError(null);
    startTransition(async () => {
      const state = await submitMoveAction({ taskId, result, ...selected });
      if (state?.error) setError(state.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-card p-4">
        <p className="text-xs text-ink-soft">判定するタスク</p>
        <p className="text-lg font-bold">{taskTitle}</p>

        {!result ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => choose("achieved")}
              className="flex flex-col items-center gap-1 rounded-lg border-2 border-line bg-white py-3 font-bold hover:border-felt"
            >
              <Stone color="white" className="h-8 w-8" />
              達成
            </button>
            <button
              type="button"
              onClick={() => choose("missed")}
              className="flex flex-col items-center gap-1 rounded-lg border-2 border-line bg-white py-3 font-bold hover:border-felt"
            >
              <Stone color="black" className="h-8 w-8" />
              未達成
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-bold">
              <Stone color={color!} className="h-7 w-7" />
              {result === "achieved" ? "達成！白石を獲得" : "未達成…黒石を獲得"}
            </p>
            {!pending && (
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setSelected(null);
                }}
                className="shrink-0 text-sm text-ink-soft underline underline-offset-2"
              >
                判定を選び直す
              </button>
            )}
          </div>
        )}
      </div>

      {result && (
        <p className="text-center text-sm text-ink-soft">
          {selected
            ? flips.length > 0
              ? `${flips.length}個の石が反転します`
              : "反転する石はありません"
            : moves.length === 0
              ? "1手目は好きなマスに置けます"
              : "光っているマスから置く場所を選んでください"}
        </p>
      )}

      <ReversiBoard
        board={board}
        placeable={placeable}
        placingColor={color ?? undefined}
        selected={selected}
        flips={flips}
        lastMove={result ? null : lastMove}
        onSelect={result && !pending ? setSelected : undefined}
      />

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      {result && (
        <button
          type="button"
          onClick={confirm}
          disabled={!selected || pending}
          className="w-full rounded-md bg-felt px-4 py-3 text-lg font-bold text-white hover:bg-felt-dark disabled:opacity-40"
        >
          {pending ? "保存中…" : selected ? "ここに置く" : "マスを選んでください"}
        </button>
      )}

      {!result && (
        <p className="text-center text-sm">
          <Link href="/" className="text-ink-soft underline underline-offset-2">
            ホームに戻る
          </Link>
        </p>
      )}
    </div>
  );
}
