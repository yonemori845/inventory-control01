/** 表示用（要件・CSV は税抜単価）。デフォルト 10% は .env で上書き可。 */
const rawRate = process.env.NEXT_PUBLIC_DEFAULT_TAX_RATE;
export const DEFAULT_CONSUMPTION_TAX_RATE =
  rawRate !== undefined && rawRate !== ""
    ? Number(rawRate)
    : 0.1;

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
