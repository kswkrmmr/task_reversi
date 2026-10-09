import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions";
import { requireUserId } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUserId();
  const session = await auth();

  return (
    <>
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-bold">
            タスクでリバーシ
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/games" className="hover:underline">
              履歴
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="text-ink-soft hover:underline" title={session?.user?.name ?? ""}>
                ログアウト
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
