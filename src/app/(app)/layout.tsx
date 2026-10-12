import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { TabBar } from "@/components/TabBar";
import { requireUserId } from "@/lib/auth/session";
import { isGuestUserId } from "@/lib/guest";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const userId = await requireUserId();
  const isGuest = isGuestUserId(userId);

  return (
    <>
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-bold">
            タスクでリバーシ
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <form action={signOutAction}>
              <button type="submit" className="text-ink-soft hover:underline">
                {isGuest ? "試用をやめる" : "ログアウト"}
              </button>
            </form>
          </nav>
        </div>
      </header>
      {isGuest && (
        <div className="border-b border-accent/30 bg-accent/10">
          <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <p>ゲストで試用中です。</p>
            <form action={signOutAction}>
              <button type="submit" className="font-bold text-accent underline underline-offset-2">
                ログインして始める
              </button>
            </form>
          </div>
        </div>
      )}
      {/* 下部の固定タブに隠れないよう、下側に余白をとる */}
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-28">{children}</main>
      <TabBar />
    </>
  );
}
