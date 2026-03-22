import { DashboardPeriodNav } from "@/components/dashboard/DashboardPeriodNav";
import { SalesChart, type DailyPoint } from "@/components/dashboard/SalesChart";
import { isInventoryAlert } from "@/lib/inventory/alerts";
import { formatYen } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  firstDayOfMonthIsoInTokyo,
  formatDateInTokyo,
  todayIsoInTokyo,
  tokyoDayRangeUtcIso,
} from "@/lib/tokyo-date";
import Link from "next/link";

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

type Search = { from?: string; to?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const sp = (await searchParams) ?? {};
  const from =
    sp.from && isIsoDate(sp.from) ? sp.from : firstDayOfMonthIsoInTokyo();
  const to = sp.to && isIsoDate(sp.to) ? sp.to : todayIsoInTokyo();
  const { startIso, endExclusiveIso } = tokyoDayRangeUtcIso(from, to);

  const supabase = await createServerSupabaseClient();

  const { data: orders, error: ordErr } = await supabase
    .from("orders")
    .select("id, total_inc_tax, placed_at")
    .gte("placed_at", startIso)
    .lt("placed_at", endExclusiveIso)
    .order("placed_at", { ascending: true });

  if (ordErr) {
    return (
      <main className="p-6">
        <p className="text-red-600">データ取得に失敗しました: {ordErr.message}</p>
      </main>
    );
  }

  const orderList = orders ?? [];
  const orderIds = orderList.map((o) => o.id);

  const sumInc = orderList.reduce((a, o) => a + Number(o.total_inc_tax), 0);
  const orderCount = orderList.length;
  const avgOrder = orderCount > 0 ? Math.round(sumInc / orderCount) : 0;

  const byDay = new Map<string, number>();
  for (const o of orderList) {
    const key = formatDateInTokyo(o.placed_at);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(o.total_inc_tax));
  }
  const daily: DailyPoint[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sales]) => ({ date, sales }));

  type SkuAgg = { sku_code: string; revenueEx: number; qty: number };
  const skuMap = new Map<string, SkuAgg>();

  if (orderIds.length > 0) {
    const { data: lines, error: lineErr } = await supabase
      .from("order_lines")
      .select(
        `
        quantity,
        line_subtotal_ex_tax,
        sku_id,
        product_skus ( sku_code )
      `,
      )
      .in("order_id", orderIds);

    if (!lineErr && lines) {
      for (const row of lines) {
        const sku = Array.isArray(row.product_skus)
          ? row.product_skus[0]
          : row.product_skus;
        const code = sku?.sku_code ?? row.sku_id;
        const prev = skuMap.get(code) ?? {
          sku_code: code,
          revenueEx: 0,
          qty: 0,
        };
        prev.revenueEx += Number(row.line_subtotal_ex_tax);
        prev.qty += row.quantity;
        skuMap.set(code, prev);
      }
    }
  }

  const top10 = [...skuMap.values()]
    .sort((a, b) => b.revenueEx - a.revenueEx)
    .slice(0, 10);

  const { data: groups } = await supabase
    .from("product_groups")
    .select(
      `
      name,
      product_skus (
        id,
        sku_code,
        quantity,
        reorder_point,
        safety_stock,
        name_variant,
        is_active
      )
    `,
    )
    .eq("is_active", true);

  const alertRows: {
    sku_code: string;
    group_name: string;
    quantity: number;
  }[] = [];
  for (const g of groups ?? []) {
    for (const s of (g.product_skus ?? []).filter((x) => x.is_active)) {
      if (isInventoryAlert(s.quantity, s.reorder_point, s.safety_stock)) {
        alertRows.push({
          sku_code: s.sku_code,
          group_name: g.name,
          quantity: s.quantity,
        });
      }
    }
  }
  const alerts = alertRows.slice(0, 12);

  return (
    <main className="relative min-h-screen pb-24">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-slate-300/[0.12] blur-[100px] dark:bg-slate-500/[0.07]" />
        <div className="absolute -right-24 top-40 h-[22rem] w-[22rem] rounded-full bg-slate-400/[0.1] blur-[90px] dark:bg-slate-600/[0.06]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <header className="border-b border-slate-200/90 pb-8 dark:border-slate-800/90">
          <p className="text-xs font-mono text-slate-500">SCR-DASH</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            ダッシュボード
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            期間内の売上・注文件数・SKU 別売上ランキングと、在庫アラートの抜粋を表示します（日付は
            Asia/Tokyo）。
          </p>
        </header>

        <div className="mt-8">
          <DashboardPeriodNav from={from} to={to} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="期間売上（税込）" value={formatYen(sumInc)} />
          <KpiCard label="期間注文数" value={`${orderCount} 件`} />
          <KpiCard label="平均注文額（税込）" value={formatYen(avgOrder)} />
          <KpiCard
            label="在庫アラート SKU"
            value={`${alertRows.length} 件`}
            warn={alertRows.length > 0}
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900 lg:col-span-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              売上推移（税込・日別）
            </h2>
            <div className="mt-4">
              <SalesChart data={daily} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              売上ランキング TOP10（税抜小計ベース）
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">SKU</th>
                    <th className="py-2 pr-2 text-right">数量</th>
                    <th className="py-2 text-right">税抜売上</th>
                  </tr>
                </thead>
                <tbody>
                  {top10.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-500"
                      >
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    top10.map((r, i) => (
                      <tr
                        key={r.sku_code}
                        className="border-b border-slate-100 dark:border-slate-800/80"
                      >
                        <td className="py-2 pr-2 tabular-nums text-slate-500">
                          {i + 1}
                        </td>
                        <td className="py-2 pr-2 font-mono text-xs text-slate-800 dark:text-slate-200">
                          {r.sku_code}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {r.qty}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {formatYen(Math.round(r.revenueEx))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                在庫アラート（抜粋）
              </h2>
              <Link
                href="/inventory"
                className="text-xs font-semibold text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
              >
                在庫一覧へ
              </Link>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {alerts.length === 0 ? (
                <li className="text-slate-500">アラートはありません。</li>
              ) : (
                alerts.map((a) => (
                  <li
                    key={a.sku_code}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30"
                  >
                    <span className="font-mono text-xs text-amber-950 dark:text-amber-100">
                      {a.sku_code}
                    </span>
                    <span className="text-xs text-amber-900/90 dark:text-amber-200/90">
                      {a.group_name} · 在庫 {a.quantity}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-card ${
        warn
          ? "border-amber-200/90 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
          : "border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 dark:text-white sm:text-2xl">
        {value}
      </p>
    </div>
  );
}
