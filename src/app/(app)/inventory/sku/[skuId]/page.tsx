import {
  isInventoryAlert,
  recommendedOrderQty,
} from "@/lib/inventory/alerts";
import {
  SkuDetailView,
  type SkuDetailRow,
} from "@/components/inventory/SkuDetailView";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function InventorySkuDetailPage({
  params,
}: {
  params: Promise<{ skuId: string }>;
}) {
  const { skuId } = await params;
  const supabase = await createServerSupabaseClient();

  const [skuRes, moveRes] = await Promise.all([
    supabase
      .from("product_skus")
      .select(
        `
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
      is_active,
      image_path,
      product_groups (
        id,
        group_code,
        name
      )
    `,
      )
      .eq("id", skuId)
      .maybeSingle(),
    supabase
      .from("inventory_movements")
      .select("created_at")
      .eq("sku_id", skuId)
      .gt("quantity_delta", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const row = skuRes.data as SkuDetailRow | null;
  if (skuRes.error || !row) notFound();

  const lastInboundAt = moveRes.data?.created_at ?? null;

  const alert = isInventoryAlert(
    row.quantity,
    row.reorder_point,
    row.safety_stock,
  );
  const rec = recommendedOrderQty(row.quantity, row.safety_stock);

  return (
    <SkuDetailView
      row={row}
      lastInboundAt={lastInboundAt}
      alert={alert}
      rec={rec}
    />
  );
}
