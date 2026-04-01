# URL 発行手順（Vercel + GitHub）

課題提出用の **https://〜** を得るための流れです。  
**このリポジトリのデフォルトブランチは `master`** です（Vercel で設定時に注意）。

---

## 全体の流れ

1. [Vercel](https://vercel.com/) にログインする  
2. GitHub の **このリポジトリ** をインポートする  
3. **環境変数** を入れる（Supabase）  
4. デプロイする → **URL が発行される**  
5. **Supabase** の認証・リダイレクト URL を本番 URL に合わせる  
6. ブラウザで本番 URL を開いて動作確認する  

---

## 1. Vercel にログイン

- [https://vercel.com/](https://vercel.com/) を開く  
- **Continue with GitHub** で GitHub アカウントと連携（初回のみ）  

---

## 2. プロジェクトを新規作成（GitHub からインポート）

1. ダッシュボードで **Add New… → Project**  
2. **Import Git Repository** で `inventory-control01`（またはあなたのリポジトリ名）を選ぶ  
3. **Framework Preset** は **Next.js** のまま（自動検出で問題ないことが多い）  
4. **Root Directory** はそのまま（リポジトリ直下）  
5. **Git の Production Branch** が **`master`** になっているか確認する  
   - もし `main` になっていたら **`master` に変更**（このリポジトリは `master` が既定）  

---

## 3. 環境変数を設定（必須）

**Settings → Environment Variables**（または初回インポート時の画面）で、次を追加する。

| Name | Value の取得元 |
|------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の **Project Settings → API → Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同じく **anon public** キー |

- ローカルの `.env.local` に書いてある値と **同じ**でよい（同じ Supabase プロジェクトを使う場合）。  
- **Production / Preview / Development** すべてにチェックを入れておくと Preview でも動きやすい。  

任意（未設定でも多くの機能は動く）:

- `NEXT_PUBLIC_DEFAULT_TAX_RATE`（例: `0.1`）  

**注意**: `SUPABASE_SERVICE_ROLE_KEY` は **Vercel の公開クライアントに載せない**運用前提。本アプリの通常画面は anon キーで動く想定です。

---

## 4. デプロイする

1. **Deploy** を押す  
2. ビルドが完了すると **Visit** または **Domains** に **`https://xxxx.vercel.app`** のような URL が表示される  
3. この URL を **課題提出用にメモ**する  

---

## 5. Supabase 側の設定（ログイン・OAuth 用・重要）

### 5.1 Site URL と Redirect URLs

Supabase ダッシュボード → **Authentication → URL Configuration**

- **Site URL**  
  - 例: `https://あなたのプロジェクト名.vercel.app`  
  - 本番として使う Vercel の URL（1つに決める）

- **Redirect URLs** に次を追加（例。実際の URL は自分のものに置き換える）:

  - `https://あなたのプロジェクト名.vercel.app/auth/callback`  
  - Preview 用にまとめて許可する場合: `https://*.vercel.app/auth/callback`  

（ローカル用の `http://localhost:3000/auth/callback` は残しておいてよい。）

### 5.2 Google でログインする場合

- **Authentication → Providers → Google** が有効  
- Google Cloud の OAuth クライアントに、Supabase が表示する **Supabase の** リダイレクト URI（`https://xxxxx.supabase.co/auth/v1/callback`）が登録されていること  

※ 本番 URL は **Vercel のドメイン** と **Supabase の認証設定** の両方が必要です。

---

## 6. 動作確認チェックリスト

- [ ] 本番 URL を開いて **ログイン画面** が表示される  
- [ ] メール／パスワードでログインできる  
- [ ] （Google を使う場合）Google でログインできる  
- [ ] ダッシュボード・在庫・注文が開ける  

---

## うまくいかないとき

| 症状 | 確認すること |
|------|----------------|
| ビルド失敗 | Vercel の **Build Logs** のエラー文。`NEXT_PUBLIC_*` の typo |
| 画面は出るがログインできない | Supabase の **Site URL / Redirect URLs** と Vercel の URL が一致しているか |
| Google だけ失敗 | Supabase の Google 有効化・Google Cloud のリダイレクト URI |

---

## 参考

- リポジトリ直下の `README.md`（デプロイ・環境変数の概要）  
- `doc/技術仕様書.md`（認証関連の詳細がある場合）  
