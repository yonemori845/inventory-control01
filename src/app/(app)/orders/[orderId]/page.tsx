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
      <main className="p-6">
        <p className="text-red-600">明細の取得に失敗しました: {lErr.message}</p>
      </main>
    );
  }

  const rows = lines ?? [];

  return (
    <main className="relative min-h-screen pb-20">
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-10">
        <p className="text-xs font-mono text-slate-500">SCR-ORD-DET</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            注文詳細
          </h1>
          <Link
            href="/orders"
            className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
          >
            一覧へ
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">
            注文番号
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white">
            {order.order_number}
          </p>
          <p className="mt-4 text-xs text-slate-500">
            確定日時（表示はローカル）
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {new Date(order.placed_at).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })}
          </p>
          <dl className="mt-6 grid gap-3 border-t border-slate-200 pt-6 dark:border-slate-700 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">税抜小計</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatYen(Number(order.subtotal_ex_tax))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">消費税</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatYen(Number(order.tax_amount))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">税込合計</dt>
              <dd className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {formatYen(Number(order.total_inc_tax))}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              明細
            </h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
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
                    className="border-b border-slate-100 dark:border-slate-800/80"
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      {sku?.sku_code ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {sku?.name_variant ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.quantity}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatYen(Number(row.unit_price_ex_tax))}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {formatYen(Number(row.line_subtotal_ex_tax))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
