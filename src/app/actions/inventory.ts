"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function adjustSkuQuantityAction(
  skuId: string,
  newQuantity: number,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "未ログインです" };

  const { error } = await supabase.rpc("adjust_sku_quantity", {
    p_sku_id: skuId,
    p_new_quantity: newQuantity,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");
  return { ok: true };
}

export async function barcodeInboundAction(
  jan: string,
  quantity: number,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "未ログインです" };

  const { error } = await supabase.rpc("barcode_inbound", {
    p_jan: jan.trim(),
    p_qty: quantity,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");
  return { ok: true };
}

export async function importProductCsvRowsAction(
  rows: Record<string, unknown>[],
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "未ログインです" };

  const { error } = await supabase.rpc("import_product_csv_rows", {
    p_rows: rows,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");
  return { ok: true };
}
