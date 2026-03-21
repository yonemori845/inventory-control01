"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={loading}
      className="w-full rounded-lg border border-transparent px-3 py-2 text-left text-xs font-semibold text-slate-600 transition hover:border-slate-200 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700/50"
    >
      {loading ? "ログアウト中…" : "ログアウト"}
    </button>
  );
}
