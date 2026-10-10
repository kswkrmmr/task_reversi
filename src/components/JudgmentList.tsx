import { Stone } from "@/components/ReversiBoard";
import { stoneColorFor } from "@/lib/game/rules";
import type { GameView } from "@/lib/game/service";

// 結果画面の「このゲームの判定一覧」。手順どおりに、どのタスクを達成・未達成にしたかを並べる。
export function JudgmentList({ judgments }: { judgments: GameView["judgments"] }) {
  if (judgments.length === 0) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm text-ink-soft select-none [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span>{" "}
        このゲームの判定一覧（{judgments.length}件）
      </summary>
      <ol className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-card text-sm">
        {judgments.map((j, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2">
            <span className="w-8 shrink-0 text-right text-xs text-ink-soft tabular-nums">{i + 1}手</span>
            <Stone color={stoneColorFor(j.result)} className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{j.taskTitle}</span>
            <span className="shrink-0 text-xs text-ink-soft">
              {j.recurrenceType === "once" ? "単発" : "毎日"} ・ {j.attemptedOn.slice(5).replace("-", "/")}
            </span>
            <span
              className={`w-12 shrink-0 text-right text-xs ${
                j.result === "achieved" ? "font-bold text-felt" : "text-ink-soft"
              }`}
            >
              {j.result === "achieved" ? "達成" : "未達成"}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
