import Link from "next/link";

// 直前の石の置き直し画面へのリンク。置き直せるときだけ表示する。
export function ReplaceLink() {
  return (
    <Link
      href="/replace"
      className="rounded-md px-2 py-1 text-sm text-ink-soft underline underline-offset-2 hover:text-ink"
    >
      直前の石を置き直す
    </Link>
  );
}
