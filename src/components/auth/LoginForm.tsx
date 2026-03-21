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
    <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-mono text-neutral-500">SCR-AUTH-LOGIN</p>
      <h1 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        ログイン
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Google またはメール・パスワードでサインインします。
      </p>

      {authError ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          認証に失敗しました。もう一度お試しください。
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        <span>Google で続ける</span>
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        <span className="text-xs text-neutral-500">または</span>
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>

      <div className="flex gap-2 text-sm">
        <button
          type="button"
          className={`rounded-md px-3 py-1 ${mode === "signin" ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-500"}`}
          onClick={() => setMode("signin")}
        >
          サインイン
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1 ${mode === "signup" ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-500"}`}
          onClick={() => setMode("signup")}
        >
          アカウント作成
        </button>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-neutral-600 dark:text-neutral-400"
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
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-neutral-600 dark:text-neutral-400"
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
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {loading ? "処理中…" : mode === "signup" ? "登録する" : "サインイン"}
        </button>
      </form>
    </div>
  );
}
