import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// ページ・Server Action から呼ぶ。未ログインならログイン画面へリダイレクトする。
// データアクセスは必ずここで得た userId で絞り込むこと。
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  return userId;
}
