import type { GameSummary as Summary } from "@/lib/game/rules";
import { StoneCounts } from "@/components/ReversiBoard";

export function GameSummary({ summary }: { summary: Summary }) {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-card p-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="達成" value={summary.achieved} />
        <Stat label="未達成" value={summary.missed} />
        <Stat label="達成率" value={`${summary.achievementRate}%`} />
      </div>
      <div className="border-t border-line pt-3">
        <p className="mb-1 text-center text-xs text-ink-soft">最終的な盤面の石</p>
        <StoneCounts white={summary.white} black={summary.black} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
