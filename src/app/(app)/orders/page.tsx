import { formatYen } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateInTokyo, todayIsoInTokyo } from "@/lib/tokyo-date";
import Link from "next/link";

export default async function OrdersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, placed_at, total_inc_tax, tax_amount, subtotal_ex_tax")
    .order("placed_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <main className="p-6">
        <p className="text-red-600">注文の取得に失敗しました: {error.message}</p>
      </main>
    );
  }

  const list = orders ?? [];
  const today = todayIsoInTokyo();
  const todayOrders = list.filter((o) => formatDateInTokyo(o.placed_at) === today);
  const totalCount = list.length;
  const sumInc = list.reduce((a, o) => a + Number(o.total_inc_tax), 0);
  const avg = list.length > 0 ? Math.round(sumInc / list.length) : 0;

  return (
    <main className="relative min-h-screen pb-20">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[24rem] w-[24rem] rounded-full bg-slate-300/[0.12] blur-[100px] dark:bg-slate-500/[0.07]" />
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-10">
        <p className="text-xs font-mono text-slate-500">SCR-ORD-LIST</p>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            注文一覧
          </h1>
          <Link
            href="/orders/new"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            新規注文
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase text-slate-500">
              総注文数（表示範囲）
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {totalCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase text-slate-500">
              本日の注文（Tokyo）
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {todayOrders.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase text-slate-500">
              平均注文額（税込・表示範囲）
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {formatYen(avg)}
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <th className="px-4 py-3">注文番号</th>
                <th className="px-4 py-3">確定日時</th>
                <th className="px-4 py-3 text-right">税込合計</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                    注文がありません。
                  </td>
                </tr>
              ) : (
                list.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-100 dark:border-slate-800/80"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-mono text-xs font-semibold text-slate-900 underline-offset-4 hover:underline dark:text-white"
                      >
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {new Date(o.placed_at).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatYen(Number(o.total_inc_tax))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
