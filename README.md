# タスクでリバーシ

タスクを達成したら白石、未達成なら黒石。獲得した石を盤面に置いて楽しむ、一人用のリバーシです。
日々のタスクや習慣を、遊び感覚で記録できます。

## 遊び方

1. タスクを登録する（単発 / 毎日）
2. タスクを選んで「達成」か「未達成」を選ぶ → 白石か黒石を獲得
3. 光っているマスから置き場所を選んで確定（挟んだ相手の石は反転）
4. 64マスが埋まったらゲーム終了。達成率と最終的な石の数が表示されます

置ける場所: 1手目は自由。2手目以降は、反転できるマスがあればそこに、無ければ既存の石に隣接するマスに置きます。
直前の1手だけ取り消せます。

## 技術スタック

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- Prisma 8 (Prisma Next) + PostgreSQL
- Auth.js v5（GitHub OAuth）
- Vitest

## セットアップ

```bash
npm install
docker compose up -d db          # Postgres（ポート5434）
cp .env.example .env             # AUTH_SECRET などを設定
npx prisma db migrate --advance-ref db
npm run dev
```

GitHub ログインを使う場合は GitHub の OAuth App を作成し、`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` を設定してください
（コールバックURL: `http://localhost:3000/api/auth/callback/github`）。
OAuth App なしで試す場合は `.env` の `AUTH_DEV_LOGIN="true"` で開発用ログインが使えます（本番では無効）。

## テスト

```bash
npm test             # 盤面ロジック・ルールのユニットテスト
npm run test:int     # DBを使う統合テスト（事前にテスト用DBを用意）
```

テスト用DBの準備（初回のみ）:

```bash
docker compose exec db createdb -U taskreversi taskreversi_test
DATABASE_URL="postgresql://taskreversi:taskreversi@localhost:5434/taskreversi_test" npx prisma db init
```
