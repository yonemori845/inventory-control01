import { AppPageMain } from "@/components/layout/app-page";
import { formatYen } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateInTokyo, todayIsoInTokyo } from "@/lib/tokyo-date";
import Link from "next/link";

export default async function OrdersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, placed_at, total_inc_tax, tax_amount, subtotal_ex_tax",
    )
    .order("placed_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <AppPageMain>
        <p className="text-red-600">注文の取得に失敗しました: {error.message}</p>
      </AppPageMain>
    );
  }

  const list = orders ?? [];
  const today = todayIsoInTokyo();
  const todayOrders = list.filter((o) => formatDateInTokyo(o.placed_at) === today);
  const totalCount = list.length;
  const sumInc = list.reduce((a, o) => a + Number(o.total_inc_tax), 0);
  const avg = list.length > 0 ? Math.round(sumInc / list.length) : 0;

  return (
    <AppPageMain className="pb-20">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Orders
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
            注文一覧
          </h1>
        </div>
        <Link
          href="/orders/new"
          className="btn-primary shrink-0 gap-2 self-start px-4"
        >
          <span aria-hidden className="text-lg leading-none">
            +
          </span>
          新規注文
        </Link>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            総注文数（表示範囲）
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
            {totalCount}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            本日の注文（Tokyo）
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
            {todayOrders.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            平均注文額（税込・表示範囲）
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
            {formatYen(avg)}
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              <th className="px-4 py-3">注文番号</th>
              <th className="px-4 py-3">確定日時</th>
              <th className="px-4 py-3 text-right">税込合計</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-neutral-500">
                  注文がありません。
                </td>
              </tr>
            ) : (
              list.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-[var(--border)]/70 last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-mono text-xs font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {new Date(o.placed_at).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--foreground)]">
                    {formatYen(Number(o.total_inc_tax))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppPageMain>
  );
}
