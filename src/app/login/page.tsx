import { redirect } from "next/navigation";
import { auth, isDevLoginEnabled, oauthProviders, signIn } from "@/auth";
import { Stone } from "@/components/ReversiBoard";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <div className="mb-3 flex justify-center gap-1">
          <Stone color="white" className="h-8 w-8" />
          <Stone color="black" className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">タスクでリバーシ</h1>
        <p className="mt-2 text-sm text-ink-soft">
          タスクを達成したら白石、未達成なら黒石。
          <br />
          獲得した石を盤面に置いて、64マスを埋めよう。
        </p>
      </div>

      <div className="space-y-3">
        {oauthProviders.map((p) => (
          <form
            key={p.id}
            action={async () => {
              "use server";
              await signIn(p.id, { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className={`w-full rounded-md px-4 py-3 font-bold hover:opacity-90 ${
                p.id === "github" ? "bg-ink text-white" : "border border-line bg-white text-ink"
              }`}
            >
              {p.label}
            </button>
          </form>
        ))}
        <p className="text-center text-xs text-ink-soft">
          ログインに使うのはアカウントの識別番号だけです。
          <br />
          メールアドレスやリポジトリなどの情報は取得しません。
        </p>
      </div>

      {isDevLoginEnabled && (
        <form
          action={async (formData: FormData) => {
            "use server";
            await signIn("dev-login", { name: formData.get("name"), redirectTo: "/" });
          }}
          className="space-y-2 rounded-lg border border-dashed border-line p-4"
        >
          <p className="text-xs font-bold text-ink-soft">開発用ログイン（本番では表示されません）</p>
          <input
            name="name"
            required
            pattern="[\w\-]{1,32}"
            placeholder="英数字の名前（例: alice）"
            className="block w-full rounded-md border border-line bg-white px-3 py-2"
          />
          <button type="submit" className="w-full rounded-md border border-line bg-card px-3 py-2">
            この名前でログイン
          </button>
        </form>
      )}
    </main>
  );
}
