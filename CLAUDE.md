@AGENTS.md

# タスクでリバーシ (task-reversi)

タスクを達成したら白石、未達成なら黒石を獲得し、8×8の盤面に自分で置いていく一人用リバーシ。
技術スタック・運用ルールは `~/workspace/asa-stamp` を土台にしている（Prisma 8 の注意点も同じ）。

## 確定済みの仕様判断（仕様書の曖昧な点をユーザーが決定したもの）
- 配置ルール: 1手目はどこでも可 → 反転できるマスがあればその中からのみ → 無ければ既存の石に8方向で隣接する空きマス。
  盤面に石があり空きマスがある限り候補は必ず存在するので詰まらない。
- 単発タスク: ゲームをまたいで生涯1回だけ判定できる。
- 繰り返しタスク（毎日）: JSTの暦日ごとに1回まで。
- 取り消し: 直前の1手のみ・連続1回まで（取り消し直後はさらに前へは戻れない。次の手を置けば再び可）。終了したゲームは不可。判定と配置は物理削除。
- 結果の「達成タスク数」はそのゲームの判定回数（同じ繰り返しタスクを3日達成したら3）。達成率は四捨五入した整数%。
- 盤面の石数とタスク達成数は別集計（反転があるため一致しない）。

## 設計の要点
- 盤面ロジックは `src/lib/reversi/board.ts`、判定・取り消し・集計ルールは `src/lib/game/rules.ts`。どちらもUI/DB非依存の純粋関数。
- 盤面はDBに保存せず、`StonePlacement` を `sequenceNumber` 順に `replay` して毎回再構築する。
- タスク判定と石の配置は `submitMove` の1トランザクションでまとめて保存する。判定結果は配置確定までクライアントの状態でしか持たない
  （＝「判定したが配置していない」状態はDBに存在しない）。
- 競合はDB制約で防ぐ: `(gameId,row,col)` / `(gameId,sequenceNumber)` / `(taskId,attemptedOn)` のunique、
  進行中ゲームは部分ユニークインデックス `game_one_in_progress` で1ユーザー1つ。
- アクセス制御: `src/lib/game/service.ts` の全関数が第1引数 `userId` で絞り込む。`userId` は必ず `requireUserId()`（`src/lib/auth/session.ts`）から得ること。RLSは使っていない。

## 認証 (Auth.js v5)
- JWTセッション・DBアダプタなし。アダプタなしだと Auth.js の `user.id` はサインインごとにランダムUUIDになるため、
  アプリのユーザーIDは jwt コールバックで `"<provider>:<providerAccountId>"`（例 `github:12345`）を作って保持している。
- 本番は GitHub OAuth。`AUTH_DEV_LOGIN=true` かつ非productionのときだけ、名前だけで入れる開発用ログイン（`dev-login:<name>`）が有効。

## テスト
- `npm test` … 盤面・ルールのユニットテスト（DB不要）
- `npm run test:int` … サービス層の統合テスト。`taskreversi_test` DB（docker composeのPostgres上）を使う
- `npm run test:all` … 両方

## Prisma 8 (Prisma Next)
asa-stamp の CLAUDE.md の注意点がそのまま当てはまる（`uuid()`、`DateString`、`db.orm.public.*`、`db migrate --advance-ref db` など）。
加えて: `contract.prisma` の1行目に `// use prisma-8` が必要。実装前に `.claude/skills/prisma-8/` を確認すること。
ローカルDBはポート **5434**（asa-stamp が 5433、ainote が 5432 を使用）。

## デプロイ (Vercel)
- 本番URL: https://task-reversi.vercel.app （Vercelプロジェクト `kswkrmmrs-projects/task-reversi`）
- DB: Vercel Marketplace の Neon（リソース名 `task-reversi-db`）。`DATABASE_URL` 等は Vercel 側に自動設定済み。
- 本番DBへのマイグレーションは `DATABASE_URL_UNPOOLED` を使って `npx prisma db migrate` で適用する（pgbouncer 経由ではDDLを流さない）。
  本番の `db` ref はローカルの `migrations/app/refs/db.json` と共有しないため、本番適用時は `--advance-ref` を付けない。
- 必要な環境変数（Production）: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`。開発用ログインは本番では無効。
- **`.env.local` を作らない・残さないこと**（asa-stamp と同じ理由で、ローカルの開発サーバーが本番DBに繋がってしまう）。
  本番の接続情報が必要なときは `vercel env pull .env.vercel-prod.local --environment=production` で別名取得し、使い終わったら削除する。

## MVPスコープ外
オンライン対戦、ランキング、Discord連携、AIタスク提案、通知・リマインダー、複数手の取り消し、自動未達成判定、曜日別繰り返し、実績バッジ・連続達成ボーナス。
