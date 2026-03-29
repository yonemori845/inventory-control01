import { DashboardAnchorNav } from "@/components/dashboard/DashboardAnchorNav";
import { DashboardPeriodNav } from "@/components/dashboard/DashboardPeriodNav";
import { SalesChart, type DailyPoint } from "@/components/dashboard/SalesChart";
import { AppPageMain } from "@/components/layout/app-page";
import { isInventoryAlert } from "@/lib/inventory/alerts";
import { formatYen } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  firstDayOfMonthIsoInTokyo,
  formatDateInTokyo,
  previousPeriodInclusiveTokyo,
  todayIsoInTokyo,
  tokyoDayRangeUtcIso,
} from "@/lib/tokyo-date";
import Link from "next/link";

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

type Search = { from?: string; to?: string };

function pctVsPrev(current: number, prev: number): {
  pct: number;
  up: boolean;
  baseline: boolean;
} | null {
  if (current === 0 && prev === 0) return null;
  if (prev === 0) return { pct: 0, up: current > 0, baseline: true };
  const pct = ((current - prev) / prev) * 100;
  return { pct, up: pct >= 0, baseline: false };
}

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
  const prevPeriod = previousPeriodInclusiveTokyo(from, to);
  const { startIso: prevStart, endExclusiveIso: prevEnd } = tokyoDayRangeUtcIso(
    prevPeriod.from,
    prevPeriod.to,
  );

  const supabase = await createServerSupabaseClient();

  const [ordersRes, prevOrdersRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total_inc_tax, placed_at")
      .gte("placed_at", startIso)
      .lt("placed_at", endExclusiveIso)
      .order("placed_at", { ascending: true }),
    supabase
      .from("orders")
      .select("total_inc_tax")
      .gte("placed_at", prevStart)
      .lt("placed_at", prevEnd),
  ]);

  const { data: orders, error: ordErr } = ordersRes;
  const { data: prevOrders } = prevOrdersRes;

  if (ordErr) {
    return (
      <AppPageMain>
        <p className="text-red-600">
          データ取得に失敗しました: {ordErr.message}
        </p>
      </AppPageMain>
    );
  }

  const orderList = orders ?? [];
  const orderIds = orderList.map((o) => o.id);

  const sumInc = orderList.reduce((a, o) => a + Number(o.total_inc_tax), 0);
  const orderCount = orderList.length;
  const avgOrder = orderCount > 0 ? Math.round(sumInc / orderCount) : 0;

  const prevList = prevOrders ?? [];
  const prevSumInc = prevList.reduce((a, o) => a + Number(o.total_inc_tax), 0);
  const prevOrderCount = prevList.length;
  const prevAvgOrder =
    prevOrderCount > 0 ? Math.round(prevSumInc / prevOrderCount) : 0;

  const revenueTrend = pctVsPrev(sumInc, prevSumInc);
  const ordersTrend = pctVsPrev(orderCount, prevOrderCount);
  const avgTrend = pctVsPrev(avgOrder, prevAvgOrder);

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
    <AppPageMain>
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              ダッシュボード
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-neutral-500">
              期間内の売上・注文・SKU ランキングと在庫アラートの抜粋。日付境界は
              Asia/Tokyo です。
            </p>
          </div>
          <Link
            href="/orders/new"
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <span aria-hidden className="text-lg leading-none">
              +
            </span>
            新規注文
          </Link>
      </header>

      <div className="mt-6">
        <DashboardPeriodNav from={from} to={to} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="期間売上（税込）"
            value={formatYen(sumInc)}
            trend={revenueTrend}
            caption="期間内の税込合計"
            foot="粗利・原価はレポートで確認できます"
          />
          <KpiCard
            label="期間注文数"
            value={`${orderCount} 件`}
            trend={ordersTrend}
            caption="成立した注文の件数"
            foot="キャンセルは別集計です"
          />
          <KpiCard
            label="平均注文額（税込）"
            value={formatYen(avgOrder)}
            trend={avgTrend}
            caption="税込合計 ÷ 注文数"
            foot="単価帯の偏りに注意"
          />
          <KpiCard
            label="在庫アラート SKU"
            value={`${alertRows.length} 件`}
            caption="発注点または安全在庫を下回る SKU"
            foot={
              alertRows.length > 0
                ? "補充・棚卸の優先度を調整してください"
                : "現時点で閾値逸脱はありません"
            }
            emphasize={alertRows.length > 0}
          />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section
            id="section-chart"
            className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card lg:col-span-2"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  売上推移
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  税込・日次の合計（線は滑らかに補間しています）
                </p>
              </div>
            </div>
            <div className="mt-5">
              <SalesChart data={daily} />
            </div>
          </section>

          <section
            id="section-ranking"
            className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card"
          >
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              売上ランキング TOP10
            </h2>
            <p className="mt-1 text-sm text-neutral-500">税抜小計ベース・数量付き</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                    <th className="py-2.5 pr-3">#</th>
                    <th className="py-2.5 pr-3">SKU</th>
                    <th className="py-2.5 pr-3 text-right">数量</th>
                    <th className="py-2.5 text-right">税抜売上</th>
                  </tr>
                </thead>
                <tbody>
                  {top10.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-neutral-500"
                      >
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    top10.map((r, i) => (
                      <tr
                        key={r.sku_code}
                        className="border-b border-[var(--border)]/70 last:border-0"
                      >
                        <td className="py-2.5 pr-3 tabular-nums text-neutral-400">
                          {i + 1}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-[var(--foreground)]">
                          {r.sku_code}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                          {r.qty}
                        </td>
                        <td className="py-2.5 text-right font-medium tabular-nums text-[var(--foreground)]">
                          {formatYen(Math.round(r.revenueEx))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="section-alerts"
            className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  在庫アラート
                </h2>
                <p className="mt-1 text-sm text-neutral-500">しきい値逸脱 SKU（抜粋）</p>
              </div>
              <Link
                href="/inventory"
                className="shrink-0 text-xs font-semibold text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
              >
                在庫一覧へ
              </Link>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {alerts.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-6 text-center text-neutral-500">
                  アラートはありません
                </li>
              ) : (
                alerts.map((a) => (
                  <li
                    key={a.sku_code}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5"
                  >
                    <span className="font-mono text-xs font-medium text-[var(--foreground)]">
                      {a.sku_code}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {a.group_name} · 在庫 {a.quantity}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
      </div>

      <div className="mt-10 pb-2">
        <DashboardAnchorNav
            items={[
              { id: "section-chart", label: "売上推移" },
              { id: "section-ranking", label: "ランキング" },
              {
                id: "section-alerts",
                label: "在庫アラート",
                badge: alertRows.length,
              },
            ]}
        />
      </div>
    </AppPageMain>
  );
}

function KpiCard({
  label,
  value,
  trend,
  caption,
  foot,
  emphasize,
}: {
  label: string;
  value: string;
  trend?: {
    pct: number;
    up: boolean;
    baseline: boolean;
  } | null;
  caption?: string;
  foot?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border bg-[var(--surface)] p-4 shadow-card sm:p-5",
        emphasize
          ? "border-[var(--border-strong)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
          : "border-[var(--border)]",
      ].join(" ")}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-2xl">
        {value}
      </p>
      {trend ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500">
          <span className="text-[var(--foreground)]" aria-hidden>
            {trend.up ? "↗" : "↘"}
          </span>
          <span className="font-medium tabular-nums text-[var(--foreground)]">
            {trend.baseline ? "—" : `${trend.up ? "+" : ""}${trend.pct.toFixed(1)}%`}
          </span>
          <span className="text-neutral-400">前期間比</span>
        </p>
      ) : null}
      {caption ? (
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">{caption}</p>
      ) : null}
      {foot ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">{foot}</p>
      ) : null}
    </div>
  );
}
