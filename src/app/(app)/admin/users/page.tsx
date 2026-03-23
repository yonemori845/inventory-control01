import { AdminUsersClient } from "@/components/admin/AdminUsersClient";
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
    <main className="relative min-h-screen pb-24">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-slate-300/[0.12] blur-[100px] dark:bg-slate-500/[0.07]" />
        <div className="absolute -right-24 top-40 h-[22rem] w-[22rem] rounded-full bg-slate-400/[0.1] blur-[90px] dark:bg-slate-600/[0.06]" />
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <header className="border-b border-slate-200/90 pb-8 dark:border-slate-800/90">
          <p className="text-xs font-mono text-slate-500">SCR-ADM-USERS</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            ユーザー管理
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            登録ユーザーのロールを確認・変更します（第1段階：管理者のみ変更可）。
          </p>
        </header>

        {error ? (
          <p className="mt-8 text-sm text-red-600 dark:text-red-400">
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
    </main>
  );
}
