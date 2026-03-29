import { AdminUsersClient } from "@/components/admin/AdminUsersClient";
import { AppPageMain } from "@/components/layout/app-page";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, created_at")
    .order("created_at", { ascending: true });

  const isAdmin = me?.role === "admin";

  return (
    <AppPageMain className="pb-24">
      <div className="mx-auto w-full max-w-5xl">
        <header className="border-b border-[var(--border)] pb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
            ユーザー管理
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
            登録ユーザーのロールを確認・変更します（第1段階：管理者のみ変更可）。
          </p>
        </header>

        {error ? (
          <p className="mt-6 text-sm text-red-600 dark:text-red-400">
            一覧の取得に失敗しました: {error.message}
          </p>
        ) : (
          <AdminUsersClient
            profiles={profiles ?? []}
            currentUserId={user.id}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </AppPageMain>
  );
}
