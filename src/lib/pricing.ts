/**
 * 税・端数（注文・RPC `place_order` と共有）
 * - 行税抜小計 = round(税抜単価 * 数量)
 * - 行税額 = round(行税抜小計 * 税率)
 * - ヘッダ税抜・税額・税込は各行の合算
 * 変更時は `supabase/migrations/20250321150000_place_order_rpc.sql` を同じルールに揃えること。
 */
const rawRate = process.env.NEXT_PUBLIC_DEFAULT_TAX_RATE;
export const DEFAULT_CONSUMPTION_TAX_RATE =
  rawRate !== undefined && rawRate !== ""
    ? Number(rawRate)
    : 0.1;

export function lineSubtotalExTax(
  unitPriceExTax: number,
  quantity: number,
): number {
  return Math.round(Number(unitPriceExTax) * quantity);
}

export function lineTaxFromSubtotal(
  lineSubtotalExTax: number,
  rate: number = DEFAULT_CONSUMPTION_TAX_RATE,
): number {
  return Math.round(lineSubtotalExTax * rate);
}

export type OrderLineInput = { unitPriceExTax: number; quantity: number };

export function orderTotalsFromLines(
  lines: OrderLineInput[],
  rate: number = DEFAULT_CONSUMPTION_TAX_RATE,
): { subtotalExTax: number; taxAmount: number; totalIncTax: number } {
  let subtotalExTax = 0;
  let taxAmount = 0;
  for (const line of lines) {
    const sub = lineSubtotalExTax(line.unitPriceExTax, line.quantity);
    subtotalExTax += sub;
    taxAmount += lineTaxFromSubtotal(sub, rate);
  }
  return {
    subtotalExTax,
    taxAmount,
    totalIncTax: subtotalExTax + taxAmount,
  };
}

export function priceIncTax(
  unitPriceExTax: number,
  rate: number = DEFAULT_CONSUMPTION_TAX_RATE,
): number {
  return Math.round(Number(unitPriceExTax) * (1 + rate));
}

export function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}
