"use client";

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
    <div className="w-full max-w-[380px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-card">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-xs font-semibold text-[var(--foreground)]"
          aria-hidden
        >
          IC
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Sign in
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            在庫コントロール
          </h1>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-neutral-500">
        Google またはメール・パスワードでサインインします。
      </p>

      {authError ? (
        <p className="mt-4 rounded-lg border border-red-200/80 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          認証に失敗しました。もう一度お試しください。
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)]">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={loading}
        className="btn btn-foreground mt-6 w-full font-semibold"
      >
        <span>Google で続ける</span>
      </button>
      <p className="mt-2 text-xs leading-relaxed text-neutral-400">
        Supabase の Authentication → Providers で Google を有効にし、Client ID /
        Secret を設定してください。未設定だと JSON エラー（provider is not
        enabled）になります。
      </p>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
          または
        </span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div
        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-1"
        role="tablist"
        aria-label="認証モード"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "signin" ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border-strong)]" : "text-neutral-500 hover:text-[var(--foreground)]"}`}
          onClick={() => setMode("signin")}
        >
          サインイン
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "signup" ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border-strong)]" : "text-neutral-500 hover:text-[var(--foreground)]"}`}
          onClick={() => setMode("signup")}
        >
          アカウント作成
        </button>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3">
        <div>
          <label
            htmlFor="email"
            className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
          >
            メール
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition focus:border-[var(--border-strong)] dark:bg-[var(--surface-muted)]"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
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
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition focus:border-[var(--border-strong)] dark:bg-[var(--surface-muted)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "処理中…" : mode === "signup" ? "登録する" : "サインイン"}
        </button>
      </form>
    </div>
  );
}
