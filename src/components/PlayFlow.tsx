"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { submitMoveAction } from "@/app/actions";
import { PlacementPicker } from "@/components/PlacementPicker";
import { ReversiBoard, Stone } from "@/components/ReversiBoard";
import { judgeGuide, stoneColorFor, type AttemptResult, type RecurrenceType } from "@/lib/game/rules";
import { placeableCells, replay, type Move, type Position } from "@/lib/reversi/board";

// タスク判定 → 石の獲得 → 配置 → 確定 までを1画面で行う。
// 判定結果はこの画面の状態として持つだけで、配置を確定したときに判定と配置をまとめて保存する。
export function PlayFlow({
  taskId,
  taskTitle,
  recurrenceType,
  dueAt,
  due,
  moves,
  lastMove,
}: {
  taskId: string;
  taskTitle: string;
  recurrenceType: RecurrenceType;
  dueAt: string | null;
  // 期限の表示（現在時刻に依存するのでサーバー側で計算して渡す）
  due: { overdue: boolean; label: string } | null;
  moves: Move[];
  lastMove: Position | null;
}) {
  const guide = judgeGuide({ recurrenceType, dueAt });
  const board = useMemo(() => replay(moves), [moves]);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const color = result ? stoneColorFor(result) : null;
  const placeable = useMemo(() => (color ? placeableCells(board, color) : []), [board, color]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-card p-4">
        <p className="text-xs text-ink-soft">判定するタスク</p>
        <p className="text-lg font-bold">{taskTitle}</p>
        {due && (
          <p className={`text-sm ${due.overdue ? "font-bold text-danger" : "text-ink-soft"}`}>
            {due.overdue ? due.label : `期限: ${due.label}`}
          </p>
        )}

        {!result ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setResult("achieved")}
              className="flex flex-col items-center gap-1 rounded-lg border-2 border-line bg-white py-3 font-bold hover:border-felt"
            >
              <Stone color="white" className="h-8 w-8" />
              達成
              <span className="px-2 text-xs font-normal text-ink-soft">{guide.achieved}</span>
            </button>
            <button
              type="button"
              onClick={() => setResult("missed")}
              className="flex flex-col items-center gap-1 rounded-lg border-2 border-line bg-white py-3 font-bold hover:border-felt"
            >
              <Stone color="black" className="h-8 w-8" />
              未達成
              <span className="px-2 text-xs font-normal text-ink-soft">{guide.missed}</span>
            </button>
            <p className="col-span-2 text-center text-xs text-ink-soft">
              選び方は目安です。最後はあなたの判断で決めてください。
            </p>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-bold">
              <Stone color={color!} className="h-7 w-7" />
              {result === "achieved" ? "達成！白石を獲得" : "未達成…黒石を獲得"}
            </p>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="shrink-0 text-sm text-ink-soft underline underline-offset-2"
            >
              判定を選び直す
            </button>
          </div>
        )}
      </div>

      {result && color ? (
        <PlacementPicker
          key={result}
          board={board}
          color={color}
          placeable={placeable}
          idleHint={
            moves.length === 0
              ? "1手目は好きなマスに置けます"
              : "光っているマスから置く場所を選んでください"
          }
          onConfirm={(pos) => submitMoveAction({ taskId, result, ...pos })}
        />
      ) : (
        <>
          <ReversiBoard board={board} lastMove={lastMove} />
          <p className="text-center text-sm">
            <Link href="/" className="text-ink-soft underline underline-offset-2">
              ホームに戻る
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
