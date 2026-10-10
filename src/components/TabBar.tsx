"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 画面下に固定するタブ（タスク / 盤面 / 履歴）。
// タスク登録・判定などの下位画面では、属するタブを選択中として表示する。
const TABS = [
  { href: "/", label: "タスク", icon: TaskIcon, match: (p: string) => p === "/" || p.startsWith("/tasks") || p.startsWith("/play") },
  { href: "/board", label: "盤面", icon: BoardIcon, match: (p: string) => p.startsWith("/board") || p.startsWith("/replace") },
  { href: "/games", label: "履歴", icon: HistoryIcon, match: (p: string) => p.startsWith("/games") },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="メイン"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
                  active ? "font-bold text-felt" : "text-ink-soft hover:text-ink"
                }`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TaskIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2.2" fill="currentColor" />
      <circle cx="15" cy="15" r="2.2" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
