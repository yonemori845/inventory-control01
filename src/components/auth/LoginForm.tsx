"use client";

import { LogoMark } from "@/components/brand/LogoMark";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginFormProps = {
  nextPath: string;
  authError?: string;
};

export function LoginForm({ nextPath, authError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const redirectTo = () => {
    const origin = window.location.origin;
    const next = nextPath.startsWith("/") ? nextPath : "/";
    return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  async function signInWithGoogle() {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo() },
      });
      if (error) setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo() },
        });
        if (error) {
          setMessage(error.message);
          return;
        }
        setMessage(
          "確認メールを送信しました。メール内のリンクから完了するか、開発環境では Dashboard でメール確認をオフにしてください。",
        );
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      router.push(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full max-w-[420px] overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_0_rgba(0,0,0,0.04),0_24px_48px_-12px_rgba(0,0,0,0.12)] dark:border-[var(--border)] dark:bg-[var(--surface)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04),0_24px_48px_-12px_rgba(0,0,0,0.65)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-300/80 to-transparent dark:via-white/10"
        aria-hidden
      />
      <div className="px-8 pb-8 pt-9 sm:px-10 sm:pb-10 sm:pt-10">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] shadow-inner dark:border-[var(--border)] dark:bg-[var(--surface-muted)]"
            aria-hidden
          >
            <LogoMark className="h-8 w-8 text-[var(--foreground)]" />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Inventory Control
          </p>
          <h1 className="mt-2 text-[1.375rem] font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-2xl">
            在庫コントロール
          </h1>
          <p className="mt-3 max-w-[22rem] text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            サインインしてダッシュボード・在庫・注文を利用します。
          </p>
        </div>

        {authError ? (
          <div
            className="mt-8 flex gap-3 rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-left text-sm text-red-900 dark:border-red-900/45 dark:bg-red-950/35 dark:text-red-100"
            role="alert"
          >
            <span
              className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden
            >
              <IconAlertCircle className="h-5 w-5" />
            </span>
            <p>認証に失敗しました。もう一度お試しください。</p>
          </div>
        ) : null}

        {message ? (
          <div
            className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-left text-sm leading-relaxed text-[var(--foreground)]"
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        ) : null}

        <div className="mt-8">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={loading}
            className="btn btn-foreground group relative w-full font-semibold transition active:scale-[0.99]"
          >
            <GoogleGlyph className="h-[18px] w-[18px] shrink-0" />
            <span>Google で続ける</span>
          </button>
          <details className="group mt-3 text-left">
            <summary className="cursor-pointer list-none text-center text-[11px] text-neutral-400 transition hover:text-neutral-600 dark:hover:text-neutral-300 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                Google 連携の設定について
                <span className="text-neutral-300 group-open:rotate-180 dark:text-neutral-600">
                  ▼
                </span>
              </span>
            </summary>
            <p className="mt-2 rounded-lg bg-[var(--surface-muted)]/80 px-3 py-2.5 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Supabase の Authentication → Providers で Google を有効にし、Client
              ID / Secret を設定してください。未設定だと「provider is not
              enabled」などのエラーになります。
            </p>
          </details>
        </div>

        <div className="my-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--border)] dark:to-[var(--border)]" />
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            またはメール
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--border)] dark:to-[var(--border)]" />
        </div>

        <div
          className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-1 dark:bg-[var(--surface-muted)]/40"
          role="tablist"
          aria-label="認証モード"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={`relative flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
              mode === "signin"
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border-strong)] dark:ring-[var(--border)]"
                : "text-neutral-500 hover:text-[var(--foreground)] dark:text-neutral-400"
            }`}
            onClick={() => setMode("signin")}
          >
            サインイン
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`relative flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
              mode === "signup"
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border-strong)] dark:ring-[var(--border)]"
                : "text-neutral-500 hover:text-[var(--foreground)] dark:text-neutral-400"
            }`}
            onClick={() => setMode("signup")}
          >
            アカウント作成
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-300"
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[var(--border-strong)] focus:ring-2 focus:ring-neutral-900/8 dark:bg-[var(--surface-muted)] dark:focus:ring-white/10"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-300"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "6文字以上" : "••••••••"}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[var(--border-strong)] focus:ring-2 focus:ring-neutral-900/8 dark:bg-[var(--surface-muted)] dark:focus:ring-white/10"
            />
            {mode === "signup" ? (
              <p className="mt-1.5 text-[11px] text-neutral-400">
                6文字以上で設定してください。
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-1 w-full font-semibold transition active:scale-[0.99]"
          >
            {loading ? "処理中…" : mode === "signup" ? "登録する" : "サインイン"}
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-500">
          続行すると、組織の在庫データへのアクセスが許可されたアカウントのみ利用できます。
        </p>
      </div>
    </div>
  );
}

function IconAlertCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

/** Google ブランドガイドラインに沿った多色「G」マーク（簡略） */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
