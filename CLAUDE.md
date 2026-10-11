@AGENTS.md

# タスクでリバーシ (task-reversi)

タスクを達成したら白石、未達成なら黒石を獲得し、8×8の盤面に自分で置いていく一人用リバーシ。
技術スタック・運用ルールは `~/workspace/asa-stamp` を土台にしている（Prisma 8 の注意点も同じ）。

## 確定済みの仕様判断（仕様書の曖昧な点をユーザーが決定したもの）
- 配置ルール: 1手目はどこでも可 → 反転できるマスがあればその中からのみ → 無ければ既存の石に8方向で隣接する空きマス。
  盤面に石があり空きマスがある限り候補は必ず存在するので詰まらない。
- 単発タスク: ゲームをまたいで生涯1回だけ判定できる。
- 繰り返しタスク（毎日）: JSTの暦日ごとに1回まで。
- 置き直し（旧「取り消し」。2026-10-10 にユーザー決定で変更）: 直前の1手の**石の位置だけ**を変えられる。判定（石の色）はそのまま。
  1手につき1回まで（次の手を置けば再び可）、元と同じマスは不可、終了したゲームは不可。
  元の石の削除と新しい位置への配置は `replaceLastMove` の1回の更新で行い、「石が置かれていない」状態を作らない。
  `Game.undoUsed` 列は「直前の手を置き直し済みか」の意味で使っている（列名は旧仕様の名残）。
- 方針（2026-10-10 ユーザーと合意）: 「タスク管理が主、リバーシはおまけ」の視点でも使えるようにする。
  石は判定したらすぐ置く（ためない）ルールは維持。
- 単発タスク: 期限（任意・日時、`dueAt`）を持てる。期限を過ぎても自動で未達成にはせず、ユーザーが判定する。
  「達成 = 期限を守ってタスク完了 / 未達成 = あきらめた・タスク完了したけど期限過ぎた」が目安（文言はユーザー指定）で、判定画面に表示する（最終判断はユーザー）。
  一時停止はなし（`active` は無視し、保存時に true に戻す）。削除できるのは未判定のものだけ。
  判定済みになったらホームの「このゲームで判定済みのタスク（N件）」に折りたたむ。ここには**今のゲームで判定したものだけ**を新しい順に出し、
  最初は10件・「もっと見る」で10件ずつ増やす。前のゲームの分は、履歴の結果画面「このゲームの判定一覧」で見る（2026-10-10 ユーザー決定）。一覧は期限が近い順・期限切れを先頭に赤字表示。
- 毎日タスク: 期限なし。一時停止できる（画面上「一時停止中」= DB の `active` が false）。一時停止中は「一時停止中のタスク（N件）」に折りたたむ。
  削除はできない（過去の判定記録を残すため）。
- 一度でも判定したタスクは種類（単発/毎日）を変えられない（2026-10-11。単発→毎日で再判定できる抜け道を塞ぐため）。名前・期限・一時停止は変えられる。
- 結果の「達成タスク数」はそのゲームの判定回数（同じ繰り返しタスクを3日達成したら3）。達成率は四捨五入した整数%。
- 盤面の石数とタスク達成数は別集計（反転があるため一致しない）。

## 画面構成
- 画面下の固定タブ（`TabBar`）で「タスク（`/`）」「盤面（`/board`）」「履歴（`/games`）」を切り替える。タスク管理として使いやすいよう、
  開いて最初に出るのはタスク一覧。タスクタブの上部には盤面の要約（石の数・手数）を1行だけ出す（2026-10-10 ユーザー決定）。
- 石を置いたあとはタスクタブへ、置き直しのあとは盤面タブへ戻る。ゲーム終了時は結果画面。

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
- 外部サービスへの許可範囲は最小限: GitHub はスコープなし（公開情報のみ）、Google は `openid` のみ。
  メールアドレス・アイコンは要求せず、JWT からも削除している。アクセストークンは保存しない。ユーザーに説明済みの方針なので広げないこと。
- クライアントIDが設定されているプロバイダだけログインボタンを出す（`oauthProviders`）。
- 同じ人でも GitHub と Google では別ユーザー（`github:…` と `google:…`）。アカウント統合はしていない。
- ゲスト（ログインせずに試す）: Credentials プロバイダ `guest` で `guest:<uuid>` を発行。記録はログイン後に引き継がない（ユーザー決定）。
  セッションは開始から7日で jwt コールバックが null を返して切れる。7日より古いゲストデータは
  Vercel Cron（`vercel.json`、毎日 18:00 UTC = 3:00 JST）→ `/api/cron/cleanup-guests` → `deleteExpiredGuestData` で削除。
  Cron ルートは `CRON_SECRET`（Vercel が Bearer で送る）で保護。ゲスト量産の対策（レート制限）は未実装で、様子見の方針。
- 本番は GitHub / Google OAuth。`AUTH_DEV_LOGIN=true` かつ非productionのときだけ、名前だけで入れる開発用ログイン（`dev-login:<name>`）が有効。

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
- 必要な環境変数（Production）: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `CRON_SECRET`。開発用ログインは本番では無効。
- GitHub 連携済み: `main` への push で本番へ自動デプロイ、他ブランチ/PR は Preview。Preview は本番と同じ Neon DB を見ているので注意。
- **`.env.local` を作らない・残さないこと**（asa-stamp と同じ理由で、ローカルの開発サーバーが本番DBに繋がってしまう）。
  本番の接続情報が必要なときは `vercel env pull .env.vercel-prod.local --environment=production` で別名取得し、使い終わったら削除する。

## MVPスコープ外
オンライン対戦、ランキング、Discord連携、AIタスク提案、通知・リマインダー、複数手の取り消し、自動未達成判定、曜日別繰り返し、実績バッジ・連続達成ボーナス。
