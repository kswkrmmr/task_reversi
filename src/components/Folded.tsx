// 「▶ ラベル（N件）」をタップで開閉する折りたたみ。0件なら何も出さない。
export function Folded({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm text-ink-soft select-none [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">▶</span> {label}（{count}件）
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
