# タスクでリバーシ

やることやって、ひっくり返せ！

うまくいかない日もある。
失敗ばかりのときだってある。

でも、そこで終わりじゃない。

ひとつの成功で、盤面が大きく変わることもある。
逆に、順調だったのに、うまくいかなくなることもある。

人生も、リバーシ（オセロ）みたいなものかもしれない。

だから、今日の一手を打とう。
できなかったことも、次の行動でひっくり返そう。

そして最後は、白石をたくさん並べて、笑って終わろう。

---
タスクを達成したら白石、未達成なら黒石。獲得した石を盤面に置いていく、一人用のリバーシ付きタスク管理アプリです。
日々のタスクや習慣を、遊び感覚で記録できます。

https://task-reversi.vercel.app

## 遊び方

1. タスクを登録する（単発 / 毎日）
2. タスクを選んで「達成」か「未達成」を選ぶ → 白石か黒石を獲得
3. 光っているマスから置き場所を選んで確定（挟んだ相手の石は反転）
4. 64マスが埋まったらゲーム終了。達成率と最終的な石の数が表示されます

- **置ける場所:** 1手目は自由。2手目以降は、反転できるマスがあればその中から、無ければ既存の石に隣接するマスから選びます。
- **置き直し:** 直前に置いた石は、1手につき1回だけ別のマスに置き直せます（判定はそのまま）。
- 獲得した石は必ずその場で置きます（ためておくことはできません）。
- 盤面の石の数とタスクの達成数は別に集計します（反転があるため一致しません）。

## 主な機能

### タスク

| | 単発タスク | 毎日タスク |
|---|---|---|
| 判定できる回数 | 1回だけ | 1日（日本時間）1回 |
| 期限 | 任意で設定できる（日時） | なし |
| やめたいとき | 未判定なら削除できる | 一時停止できる |
| 判定後 | 「判定済みのタスク」に移る | 一覧に残り、翌日また判定できる |

- 一覧は期限が近い順に並び、期限切れのタスクは先頭に赤字で表示されます。
- 期限を過ぎても自動で「未達成」にはなりません。判定はいつも自分で行います。
- 判定画面には、達成・未達成の選び方の目安が表示されます（例: 達成「期限を守ってタスク完了」、未達成「あきらめた」「タスク完了したけど期限過ぎた」）。

### 画面

画面下のタブで切り替えます。

- **タスク:** タスク一覧と、盤面の要約（石の数・手数）
- **盤面:** 現在の盤面と、直前の石の置き直し
- **履歴:** 終了したゲームの一覧と、それぞれの結果

### ログイン

- GitHub または Google でログインします。どちらもアカウントの識別番号だけを受け取り、メールアドレスなどの情報は取得しません。
- 「ログインせずに試す」でゲストとしても使えます。
- メールアドレスでのログインは敢えて作っていません。（メールアドレス、パスワードを当アプリで保管しない）

## 技術スタック

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- Prisma 8 (Prisma Next) + PostgreSQL
- Auth.js v5（GitHub / Google OAuth、ゲストログイン）
- Vitest
- デプロイ: Vercel + Neon Postgres（Vercel Marketplace 経由）、ゲストデータの削除は Vercel Cron

## セットアップ

### 必要なもの

- Node.js
- Docker（ローカルDB用）

### 手順

```bash
npm install
docker compose up -d db          # Postgres（ポート5434）
cp .env.example .env             # AUTH_SECRET などを設定
npx prisma db migrate --advance-ref db
npm run dev
```

[http://localhost:3000](http://localhost:3000) で確認できます。

- OAuth を設定しなくても、`.env` の `AUTH_DEV_LOGIN="true"` で名前だけで入れる開発用ログインが使えます（本番では無効）。
- GitHub ログインを使う場合は GitHub の OAuth App を作成し、`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` を設定してください
  （コールバックURL: `http://localhost:3000/api/auth/callback/github`）。
- Google ログインを使う場合は Google Cloud で OAuth クライアントを作成し、`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` を設定してください
  （リダイレクトURI: `http://localhost:3000/api/auth/callback/google`）。
- クライアントIDを設定していないプロバイダのログインボタンは表示されません。

## テスト

```bash
npm test             # 盤面ロジック・ルールのユニットテスト
npm run test:int     # DBを使う統合テスト（事前にテスト用DBを用意）
npm run test:all     # 両方
```

テスト用DBの準備（初回のみ）:

```bash
docker compose exec db createdb -U taskreversi taskreversi_test
DATABASE_URL="postgresql://taskreversi:taskreversi@localhost:5434/taskreversi_test" npx prisma db init
```

スキーマを変更したときは、テスト用DBにも `DATABASE_URL=... npx prisma db migrate` で反映してください。

## 開発フロー

機能ごとにブランチを切り、プルリクエストを作成します。

```bash
git checkout -b feature/xxx
# 実装・コミット
git push -u origin feature/xxx
gh pr create
```

## デプロイ

GitHub リポジトリと Vercel を連携しているため、`main` ブランチへのマージで本番に自動デプロイされます。
プルリクエストやブランチへの push では Preview 環境が作られます（Preview は本番と同じDBを使うので注意してください）。

スキーマを変更した場合は、デプロイの**前に**本番DBへマイグレーションを適用します（列の追加など、古いコードでも動く変更にしてください）。
本番の接続情報は `vercel env pull .env.vercel-prod.local --environment=production` で別名のファイルに取得し、
`DATABASE_URL_UNPOOLED` を使って `npx prisma db migrate` を実行したあと、ファイルは削除してください。

> `.env.local` は作らないでください。Next.js は `.env` より `.env.local` を優先して読むため、ローカルの開発サーバーが本番DBに接続してしまいます。

本番に必要な環境変数: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `CRON_SECRET`
（`DATABASE_URL` などのDB接続情報は Neon 連携で自動設定されます）
