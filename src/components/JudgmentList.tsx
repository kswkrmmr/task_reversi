import { Folded } from "@/components/Folded";
import { Stone } from "@/components/ReversiBoard";
import { RECURRENCE_LABELS, RESULT_LABELS, stoneColorFor } from "@/lib/game/rules";
import type { GameView } from "@/lib/game/service";

// 結果画面の「このゲームの判定一覧」。手順どおりに、どのタスクを達成・未達成にしたかを並べる。
export function JudgmentList({ judgments }: { judgments: GameView["judgments"] }) {
  return (
    <Folded label="このゲームの判定一覧" count={judgments.length}>
      <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card text-sm">
        {judgments.map((j, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2">
            <span className="w-8 shrink-0 text-right text-xs text-ink-soft tabular-nums">{i + 1}手</span>
            <Stone color={stoneColorFor(j.result)} className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{j.taskTitle}</span>
            <span className="shrink-0 text-xs text-ink-soft">
              {RECURRENCE_LABELS[j.recurrenceType]} ・ {j.attemptedOn.slice(5).replace("-", "/")}
            </span>
            <span
              className={`w-12 shrink-0 text-right text-xs ${
                j.result === "achieved" ? "font-bold text-felt" : "text-ink-soft"
              }`}
            >
              {RESULT_LABELS[j.result]}
            </span>
          </li>
        ))}
      </ol>
    </Folded>
  );
}
