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
3. **SQL Editor** で `supabase/migrations/` 内の SQL を**上から順に**実行するか、[Supabase CLI](https://supabase.com/docs/guides/cli) で `supabase db push` 等によりマイグレーションを適用する。

認証・RLS の詳細は `doc/技術仕様書.md` を参照してください。

## Docker PostgreSQL から Supabase へ切り替える場合

ローカルで `DATABASE_URL` のみを使ってマイグレーションを流していた場合は、アプリの実行時は `.env.local` の `NEXT_PUBLIC_SUPABASE_*` を Supabase 側の値に差し替えればよいです。スキーマは同じマイグレーション SQL を Supabase に適用して揃えてください。

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
