import { CameraTestPanel } from "@/components/settings/CameraTestPanel";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { AppPageMain } from "@/components/layout/app-page";
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
    <AppPageMain className="pb-24">
      <div className="mx-auto w-full max-w-3xl">
        <header className="border-b border-[var(--border)] pb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
            設定
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
            プロフィール・DB 疎通・カメラ診断・開発用シード（環境変数で制御）をまとめています。
          </p>
        </header>

        {profileErr ? (
          <p className="mt-6 text-sm text-red-600 dark:text-red-400">
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
            <div className="mt-6">
              <CameraTestPanel />
            </div>
          </>
        )}
      </div>
    </AppPageMain>
  );
}
