"use server";

import { isAppRole } from "@/lib/admin-roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateProfileRoleAction(
  targetUserId: string,
  role: string,
): Promise<ActionResult> {
  if (!isAppRole(role)) {
    return { ok: false, message: "不正なロールです。" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "未ログインです。" };

  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (meErr || !me) {
    return { ok: false, message: "プロフィールを取得できませんでした。" };
  }
  if (me.role !== "admin") {
    return { ok: false, message: "ロール変更は管理者のみ実行できます。" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", targetUserId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/settings");
  return { ok: true };
}
