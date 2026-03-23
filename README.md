# 在庫管理システム（Inventory Control）

Next.js（App Router）+ Supabase を前提とした課題用アプリです。仕様の正は `doc/` 配下の設計書です。

## 前提

- Node.js 20 系推奨（技術仕様書 §1 に準拠）
- [Supabase](https://supabase.com/) プロジェクト（または後から Docker PostgreSQL へ切り替え）

## ローカル起動

```bash
cp .env.example .env.local
# .env.local に NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を設定
npm install
npm run dev
```

ブラウザで <http://localhost:3000> を開きます。

### カメラでバーコードをスキャンするには

ブラウザは**セキュアなページ**からしかカメラ（`getUserMedia`）を起動できません。次のとおりです。

| 開き方 | カメラ |
|--------|--------|
| `http://localhost:3000` または `http://127.0.0.1:3000` | 通常は利用可 |
| `http://192.168.x.x:3000` のような **LAN の IP アドレス** | **多くのブラウザでブロック**（Chrome でも「Could not start video source」になりがち） |
| `https://…`（本番・ngrok など） | 利用可 |

**うまくいかないときのチェックリスト**

1. **URL を確認する**  
   同じ PC で試すなら、アドレスバーが `localhost` か `127.0.0.1` になっているか見る（PC名や IP だけの URL になっていないか）。
2. **権限を確認する**  
   アドレスバー左の鍵／カメラアイコンから、このサイトのカメラを「許可」にする。
3. **他アプリを閉じる**  
   Zoom・Teams・別タブのビデオ通話がカメラを掴んでいると「Could not start video source」になりやすい。
4. **スマホから PC の開発サーバーに繋ぐ場合**  
   HTTP の IP ではカメラが使えないことが多いです。次のいずれかを検討する。  
   - PC 上で HTTPS 付き開発サーバーを使う: `npm run dev:https`（初回はブラウザで自己署名証明書を信頼する操作が出ることがあります）  
   - [ngrok](https://ngrok.com/) などで `https://xxxx.ngrok.io` のように HTTPS の URL を用意して、そこからアクセスする  
5. **代替**  
   カメラがどうしても使えなくても、**JAN を手入力**すれば入庫・注文の機能は利用できます。

ログイン後の **設定（`/settings`）** に「カメラ（ブラウザ）の確認」があり、**セキュアコンテキストの有無**と **getUserMedia の単体テスト**ができます。Zoom で動いてもブラウザで失敗する場合の切り分けに使ってください。

## Supabase プロジェクトの用意

1. Supabase で新規プロジェクトを作成する。
2. **Project Settings → API** から `Project URL` と `anon` `public` キーをコピーし、`.env.local` に貼る（`.env.example` のキー名に対応）。
3. **SQL Editor** で `supabase/migrations/` 内の SQL を**上から順に**実行するか、[Supabase CLI](https://supabase.com/docs/guides/cli) で `supabase db push` 等によりマイグレーションを適用する。在庫の手動更新・CSV 一括取込・JAN 入庫には **`20250321140000_inventory_rpcs.sql`**（RPC）が必要です。

認証・RLS の詳細は `doc/技術仕様書.md` を参照してください。

### 認証（Google / メール）

1. **Authentication → Providers** で Email（および任意で Google）を有効にする。ローカル開発ではメール確認をオフにできる（Dashboard のメールテンプレ／確認設定）。
2. **Authentication → URL Configuration**
   - **Site URL**: `http://localhost:3000`（本番では Vercel の URL）
   - **Redirect URLs** に `http://localhost:3000/auth/callback` を追加（Preview 用に `https://*.vercel.app/auth/callback` を足すかは運用で決定。技術仕様書 §4.2 参照）
3. **Google でログインする場合は必須**: **Authentication → Providers → Google** を **有効**にし、[Google Cloud Console](https://console.cloud.google.com/) で作った OAuth クライアントの **Client ID / Client Secret** を貼る。無効のまま「Google で続ける」を押すと、API が JSON で `Unsupported provider: provider is not enabled`（400）を返す。
4. Google Cloud の OAuth クライアントに、Supabase の Google 設定画面に表示される **callback URL**（`https://<project-ref>.supabase.co/auth/v1/callback` 形式）を **承認リダイレクト URI** として登録する。

`SUPABASE_SERVICE_ROLE_KEY` は **サーバー専用**（管理者 API 等）。`NEXT_PUBLIC_*` に含めない（技術仕様書 §5・§10）。

**Google を設定しない場合**: Providers で Google はオフのままにし、ログイン画面では **メール／パスワード**だけ使う。

`doc/template_DB.ods` を在庫 CSV にしたい場合は、**[在庫CSVとtemplate_DBの対応.md](./doc/在庫CSVとtemplate_DBの対応.md)** を参照してください（`.ods` はそのままではアップロード不可。列の対応付けが必要です）。

## Docker PostgreSQL から Supabase へ切り替える場合

ローカルで `DATABASE_URL` のみを使ってマイグレーションを流していた場合は、アプリの実行時は `.env.local` の `NEXT_PUBLIC_SUPABASE_*` を Supabase 側の値に差し替えればよいです。スキーマは同じマイグレーション SQL を Supabase に適用して揃えてください。

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー（Turbopack） |
| `npm run dev:https` | 開発サーバー（HTTPS・LAN からのカメラ検証用） |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー（`build` 後） |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | Playwright（E2E-01〜03） |

## E2E（Playwright）

機能設計書 §11（E2E-01〜03）に対応したテストが `e2e/` にあります。

### 前提

- Supabase に **メール／パスワード**のテストユーザー（在庫・注文を触れる `authenticated` ユーザー）を用意する。ローカルでは **メール確認をオフ**にすると楽です。
- データベースに **アクティブな SKU が 1 件以上**あること（E2E-02・03）。先頭 SKU の在庫が 0 だと E2E-02 はスキップされます。

### ローカル実行

1. `.env.local` に `NEXT_PUBLIC_SUPABASE_*` を設定する。  
2. 同じファイル（またはシェル）に次を追加する。

```bash
E2E_TEST_EMAIL=あなたのテスト用メール
E2E_TEST_PASSWORD=パスワード
```

3. 初回のみブラウザ取得: `npx playwright install chromium`  
4. ビルド済みの本番サーバーでテストする（推奨）:

```bash
npm run build
npm run start
# 別ターミナル
set PLAYWRIGHT_SKIP_WEB_SERVER=1
set PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000
npm run test:e2e
```

（PowerShell の場合は ` $env:PLAYWRIGHT_SKIP_WEB_SERVER=1` など。）

`PLAYWRIGHT_SKIP_WEB_SERVER` を付けない場合、`playwright.config.ts` が `npm run start` を起動します（事前に `npm run build` が必要）。

### GitHub Actions（CI）

`.github/workflows/ci.yml` が `push` / `pull_request`（`main` / `master`）で **lint → typecheck → build → E2E** を実行します。

**Repository secrets**（Settings → Secrets and variables → Actions）に次を設定してください。

| Secret 名 | 用途 |
|-----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | CI の `next build` と E2E 実行時 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上 |
| `E2E_TEST_EMAIL` | E2E ログイン用メール |
| `E2E_TEST_PASSWORD` | E2E ログイン用パスワード |

Secrets が無いフォークからの PR では、ビルド用にプレースホルダ URL が使われ、**E2E はスキップ**されて緑になる場合があります。本リポジトリでは上記を設定し、**実際に E2E が走る状態**を正とします。

## デプロイ（技術仕様書 §6.3 パターン B の考え方）

**推奨の流れ**: `main` にマージする前に **CI（上記）が成功**することを必須にし、その後に Vercel（等）へデプロイする。

1. Vercel プロジェクトに **本番用**の `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定する（`.env.local` と同じキー名）。  
2. GitHub の **Environments**（例: `production`）と **Deployment branches** で、`main` のみデプロイするよう制限できる。  
3. **パターン B（E2E 成功後に deploy）** を厳密に行う場合は、Vercel の **Ignored Build Step** で「CI 成功ワークフロー完了後のみビルド」する、または [Official Integration](https://vercel.com/docs/deployments/git/vercel-for-github) と **required status check** を組み合わせ、`CI` ジョブが緑のコミットだけが本番に乗るようにする。

詳細は `doc/技術仕様書.md` §6 を参照してください。

## `main` のブランチ保護（推奨）

GitHub リポジトリの **Settings → Branches → Branch protection rule**（`main`）で例えば次を有効にします。

- **Require status checks to pass before merging** … チェック名に `ci`（ワークフロー名に合わせる）を指定  
- **Require a pull request before merging**（運用に応じて）

チェックの正確な表示名は、初回 PR 後に Actions タブで確認してください。
