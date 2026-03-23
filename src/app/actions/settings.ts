"use server";

import { DEV_SEED_ROWS } from "@/lib/seed/dev-seed-rows";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function allowDevSeed(): boolean {
  return process.env.ALLOW_DEV_SEED === "true";
}

export async function updateDisplayNameAction(
  displayName: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "未ログインです。" };

  const trimmed = displayName.trim();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed.length ? trimmed : null })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function seedDevDataAction(): Promise<ActionResult> {
  if (!allowDevSeed()) {
    return {
      ok: false,
      message:
        "開発シードは無効です。サーバーに ALLOW_DEV_SEED=true を設定してください。",
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "未ログインです。" };

  const { error } = await supabase.rpc("import_product_csv_rows", {
    p_rows: DEV_SEED_ROWS,
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");
  revalidatePath("/settings");
  return { ok: true, message: "デモ用 SKU を取り込みました（追記・上書きのみ）。" };
}
