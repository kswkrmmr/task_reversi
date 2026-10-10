import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { GUEST_PROVIDER_ID, GUEST_TTL_MS } from "@/lib/guest";

// DBアダプタを使わない JWT セッション。
// アダプタなしだと Auth.js の user.id はサインインごとにランダムなUUIDになるため、
// アプリのユーザーIDは「プロバイダ名:プロバイダ側のアカウントID」から作って JWT に保持する。
//
// 外部サービスへの許可範囲は最小にする。このアプリが必要なのは「同じ人かどうか」を識別するIDだけなので、
// メールアドレスやアイコンは要求せず、受け取っても session に載せない。
// アクセストークンも保存しない（jwt コールバックで account から uid 以外を取り出さない）。

export const isDevLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "true";

// クライアントIDが設定されているプロバイダだけを有効にする（未設定のボタンを出さないため）。
export const oauthProviders = [
  process.env.AUTH_GITHUB_ID && { id: "github", label: "GitHubでログイン" },
  process.env.AUTH_GOOGLE_ID && { id: "google", label: "Googleでログイン" },
].filter((p): p is { id: string; label: string } => Boolean(p));

const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_GITHUB_ID) {
  providers.push(
    GitHub({
      // スコープなし = 公開情報の読み取りのみ（既定の read:user user:email は要求しない）。
      authorization: { params: { scope: "" } },
      profile: (profile) => ({ id: String(profile.id), name: profile.login }),
    }),
  );
}

if (process.env.AUTH_GOOGLE_ID) {
  providers.push(
    Google({
      // openid のみ = Googleアカウントの識別子(sub)だけを受け取る（既定の email profile は要求しない）。
      authorization: { params: { scope: "openid" } },
      profile: (profile) => ({ id: profile.sub }),
    }),
  );
}

// ログインせずに試す: 入力なしでランダムなIDのゲストユーザーになる（userId は "guest:<uuid>"）。
providers.push(
  Credentials({
    id: GUEST_PROVIDER_ID,
    name: "ゲスト",
    credentials: {},
    authorize: () => ({ id: crypto.randomUUID(), name: "ゲスト" }),
  }),
);

if (isDevLoginEnabled) {
  // 開発専用: 名前を入れるだけでログインできる。OAuth Appを用意せずに動作確認するためのもの。
  providers.push(
    Credentials({
      id: "dev-login",
      name: "開発用ログイン",
      credentials: { name: { label: "名前" } },
      authorize(credentials) {
        const name = typeof credentials.name === "string" ? credentials.name.trim() : "";
        if (!/^[\w-]{1,32}$/.test(name)) return null;
        return { id: name, name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, account }) {
      if (account) {
        token.uid = `${account.provider}:${account.providerAccountId}`;
        if (account.provider === GUEST_PROVIDER_ID) token.guestSince = Date.now();
      }
      // ゲストのセッションは開始から7日で切る（期限切れのゲストデータは定期実行で削除される）。
      if (typeof token.guestSince === "number" && Date.now() - token.guestSince > GUEST_TTL_MS) {
        return null;
      }
      delete token.email;
      delete token.picture;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") {
        session.user.id = token.uid;
      }
      return session;
    },
  },
});
