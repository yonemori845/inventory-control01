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
      className="btn w-full justify-start bg-[var(--surface-muted)] px-3 text-left text-xs font-semibold text-neutral-700 hover:bg-[var(--surface)] dark:text-neutral-200"
    >
      {loading ? "ログアウト中…" : "ログアウト"}
    </button>
  );
}
