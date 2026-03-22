import type { SupabaseClient } from "@supabase/supabase-js";
import { tokyoDayRangeUtcIso } from "@/lib/tokyo-date";

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function loadReportContext(
  supabase: SupabaseClient,
  from: string,
  to: string,
) {
  const { startIso, endExclusiveIso } = tokyoDayRangeUtcIso(from, to);

  const { data: orders, error: oErr } = await supabase
    .from("orders")
    .select("id, order_number, placed_at, subtotal_ex_tax, tax_amount, total_inc_tax")
    .gte("placed_at", startIso)
    .lt("placed_at", endExclusiveIso)
    .order("placed_at", { ascending: true });

  if (oErr) throw new Error(oErr.message);

  const orderList = orders ?? [];
  const orderIds = orderList.map((o) => o.id);

  const lineRows: {
    order_id: string;
    quantity: number;
    line_subtotal_ex_tax: number;
    sku_id: string;
    sku_code: string;
  }[] = [];

  if (orderIds.length > 0) {
    const { data: lines, error: lErr } = await supabase
      .from("order_lines")
      .select(
        `
        order_id,
        quantity,
        line_subtotal_ex_tax,
        sku_id,
        product_skus ( sku_code )
      `,
      )
      .in("order_id", orderIds);

    if (lErr) throw new Error(lErr.message);

    for (const row of lines ?? []) {
      const sku = Array.isArray(row.product_skus)
        ? row.product_skus[0]
        : row.product_skus;
      lineRows.push({
        order_id: row.order_id,
        quantity: row.quantity,
        line_subtotal_ex_tax: Number(row.line_subtotal_ex_tax),
        sku_id: row.sku_id,
        sku_code: sku?.sku_code ?? row.sku_id,
      });
    }
  }

  return { orders: orderList, lineRows };
}
