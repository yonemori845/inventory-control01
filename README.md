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
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
