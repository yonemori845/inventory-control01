"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

export type ResolveJanResult =
  | { ok: true; jan: string }
  | { ok: false; message: string };

/** 商品名・JAN・SKU コードなどから、入庫対象の JAN（1 件）に解決する */
export async function resolveJanForInboundAction(
  query: string,
): Promise<ResolveJanResult> {
  const q = query.trim();
  if (!q) {
    return { ok: false, message: "検索語を入力してください。" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "未ログインです。" };

  const jans = new Set<string>();

  const { data: byJan } = await supabase
    .from("product_skus")
    .select("jan_code")
    .eq("is_active", true)
    .eq("jan_code", q)
    .limit(5);
  byJan?.forEach((r) => jans.add(r.jan_code));

  const { data: bySku } = await supabase
    .from("product_skus")
    .select("jan_code")
    .eq("is_active", true)
    .eq("sku_code", q)
    .limit(5);
  bySku?.forEach((r) => jans.add(r.jan_code));

  const pattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  const { data: bySkuLike } = await supabase
    .from("product_skus")
    .select("jan_code")
    .eq("is_active", true)
    .ilike("sku_code", pattern);
  bySkuLike?.forEach((r) => jans.add(r.jan_code));

  const { data: byVariant } = await supabase
    .from("product_skus")
    .select("jan_code")
    .eq("is_active", true)
    .ilike("name_variant", pattern);
  byVariant?.forEach((r) => jans.add(r.jan_code));

  const { data: byJanLike } = await supabase
    .from("product_skus")
    .select("jan_code")
    .eq("is_active", true)
    .ilike("jan_code", pattern);
  byJanLike?.forEach((r) => jans.add(r.jan_code));

  const { data: groupRows } = await supabase
    .from("product_groups")
    .select("id")
    .eq("is_active", true)
    .ilike("name", pattern);
  const gids = groupRows?.map((g) => g.id) ?? [];
  if (gids.length > 0) {
    const { data: byGroup } = await supabase
      .from("product_skus")
      .select("jan_code")
      .eq("is_active", true)
      .in("product_group_id", gids);
    byGroup?.forEach((r) => jans.add(r.jan_code));
  }

  const uniq = [...jans];
  if (uniq.length === 1) {
    return { ok: true, jan: uniq[0] };
  }
  if (uniq.length === 0) {
    return {
      ok: false,
      message: "該当する商品が見つかりません。商品名・JAN・SKU を確認してください。",
    };
  }
  return {
    ok: false,
    message: `複数の SKU が該当しました（${uniq.length} 件）。JAN コードを直接入力して絞り込んでください。`,
  };
}

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
  revalidatePath(`/inventory/sku/${skuId}`);
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
