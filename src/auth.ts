import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";

// DBアダプタを使わない JWT セッション。
// アダプタなしだと Auth.js の user.id はサインインごとにランダムなUUIDになるため、
// アプリのユーザーIDは「プロバイダ名:プロバイダ側のアカウントID」から作って JWT に保持する。

export const isDevLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "true";

const providers: NextAuthConfig["providers"] = [GitHub];

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
      }
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
