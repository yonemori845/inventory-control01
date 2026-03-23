import { CameraTestPanel } from "@/components/settings/CameraTestPanel";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const [{ data: profile, error: profileErr }, health] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("product_skus").select("id").limit(1),
  ]);

  const dbOk = !health.error;
  const dbDetail = health.error?.message ?? null;

  const allowDevSeed = process.env.ALLOW_DEV_SEED === "true";

  return (
    <main className="relative min-h-screen pb-24">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-slate-300/[0.12] blur-[100px] dark:bg-slate-500/[0.07]" />
        <div className="absolute -right-24 top-40 h-[22rem] w-[22rem] rounded-full bg-slate-400/[0.1] blur-[90px] dark:bg-slate-600/[0.06]" />
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <header className="border-b border-slate-200/90 pb-8 dark:border-slate-800/90">
          <p className="text-xs font-mono text-slate-500">SCR-SET</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            設定
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            プロフィール・DB 疎通・カメラ診断・開発用シード（環境変数で制御）をまとめています。
          </p>
        </header>

        {profileErr ? (
          <p className="mt-8 text-sm text-red-600 dark:text-red-400">
            プロフィールの取得に失敗しました: {profileErr.message}
          </p>
        ) : (
          <>
            <SettingsClient
              email={user.email}
              initialDisplayName={profile?.display_name ?? null}
              role={profile?.role ?? "—"}
              dbOk={dbOk}
              dbDetail={dbDetail}
              allowDevSeed={allowDevSeed}
            />
            <div className="mt-8">
              <CameraTestPanel />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
