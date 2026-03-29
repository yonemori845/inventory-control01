import {
  InventoryListClient,
  type GroupRow,
} from "@/components/inventory/InventoryListClient";
import { AppPageMain } from "@/components/layout/app-page";
import { isInventoryAlert } from "@/lib/inventory/alerts";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const supabase = await createServerSupabaseClient();

  const { data: groups, error } = await supabase
    .from("product_groups")
    .select(
      `
      id,
      group_code,
      name,
      sort_order,
      is_active,
      product_skus (
        id,
        sku_code,
        jan_code,
        name_variant,
        color,
        size,
        quantity,
        reorder_point,
        safety_stock,
        unit_price_ex_tax,
        is_active
      )
    `,
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <AppPageMain>
        <p className="text-red-600">データの取得に失敗しました: {error.message}</p>
      </AppPageMain>
    );
  }

  const list = (groups ?? []).map((g) => ({
    ...g,
    product_skus: (g.product_skus ?? []).filter((s) => s.is_active),
  })) as GroupRow[];
  const skus = list.flatMap((g) => g.product_skus ?? []);
  const totalQty = skus.reduce((a, s) => a + s.quantity, 0);
  const alertCount = skus.filter((s) =>
    isInventoryAlert(s.quantity, s.reorder_point, s.safety_stock),
  ).length;

  const summary = {
    groupCount: list.length,
    skuCount: skus.length,
    totalQty,
    alertCount,
  };

  return (
    <AppPageMain className="pb-24">
      <InventoryListClient groups={list} summary={summary} />
    </AppPageMain>
  );
}
