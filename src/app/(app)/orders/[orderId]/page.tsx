import { AppPageMain } from "@/components/layout/app-page";
import { formatYen } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ orderId: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select(
      "id, order_number, placed_at, subtotal_ex_tax, tax_amount, total_inc_tax",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (oErr || !order) notFound();

  const { data: lines, error: lErr } = await supabase
    .from("order_lines")
    .select(
      `
      id,
      quantity,
      unit_price_ex_tax,
      line_subtotal_ex_tax,
      product_skus ( sku_code, name_variant )
    `,
    )
    .eq("order_id", orderId);

  if (lErr) {
    return (
      <AppPageMain>
        <p className="text-red-600">明細の取得に失敗しました: {lErr.message}</p>
      </AppPageMain>
    );
  }

  const rows = lines ?? [];

  return (
    <AppPageMain className="pb-20">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Orders
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              注文詳細
            </h1>
          </div>
          <Link
            href="/orders"
            className="shrink-0 text-sm font-semibold text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            一覧へ
          </Link>
        </header>

        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            注文番号
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-[var(--foreground)]">
            {order.order_number}
          </p>
          <p className="mt-4 text-xs text-neutral-500">確定日時（Asia/Tokyo）</p>
          <p className="text-sm text-[var(--foreground)]">
            {new Date(order.placed_at).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })}
          </p>
          <dl className="mt-5 grid gap-3 border-t border-[var(--border)] pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-neutral-500">税抜小計</dt>
              <dd className="text-lg font-semibold tabular-nums text-[var(--foreground)]">
                {formatYen(Number(order.subtotal_ex_tax))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">消費税</dt>
              <dd className="text-lg font-semibold tabular-nums text-[var(--foreground)]">
                {formatYen(Number(order.tax_amount))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">税込合計</dt>
              <dd className="text-lg font-semibold tabular-nums text-[var(--foreground)]">
                {formatYen(Number(order.total_inc_tax))}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              明細
            </h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">名称</th>
                <th className="px-4 py-2 text-right">数量</th>
                <th className="px-4 py-2 text-right">税抜単価</th>
                <th className="px-4 py-2 text-right">税抜小計</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sku = Array.isArray(row.product_skus)
                  ? row.product_skus[0]
                  : row.product_skus;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border)]/70 last:border-0"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-[var(--foreground)]">
                      {sku?.sku_code ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                      {sku?.name_variant ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.quantity}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatYen(Number(row.unit_price_ex_tax))}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-[var(--foreground)]">
                      {formatYen(Number(row.line_subtotal_ex_tax))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppPageMain>
  );
}
