import { buildInventoryCsvDocument } from "@/lib/inventory/csv-export";
import type { InventoryCsvRow } from "@/lib/inventory/csv";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: groups, error } = await supabase
    .from("product_groups")
    .select(
      `
      group_code,
      name,
      description,
      sort_order,
      product_skus (
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
    return new NextResponse(error.message, { status: 500 });
  }

  const rows: InventoryCsvRow[] = [];
  for (const g of groups ?? []) {
    const skus = (g.product_skus ?? []).filter((s) => s.is_active);
    skus.sort((a, b) => a.sku_code.localeCompare(b.sku_code));
    for (const s of skus) {
      rows.push({
        group_code: g.group_code,
        group_name: g.name,
        sku_code: s.sku_code,
        jan_code: s.jan_code,
        name_variant: (s.name_variant ?? "").trim(),
        color: (s.color ?? "").trim(),
        size: (s.size ?? "").trim(),
        quantity: Number(s.quantity) || 0,
        reorder_point: Number(s.reorder_point) || 0,
        safety_stock: Number(s.safety_stock) || 0,
        unit_price_ex_tax: Number(s.unit_price_ex_tax) || 0,
        is_active: s.is_active,
        group_description: (g.description ?? "").trim(),
        sort_order: Number(g.sort_order) || 0,
      });
    }
  }

  const body = buildInventoryCsvDocument(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory_export_${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
