import { AppPageMain } from "@/components/layout/app-page";
import { formatYen } from "@/lib/pricing";
import { isIsoDate, loadReportContext } from "@/lib/report-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  firstDayOfMonthIsoInTokyo,
  todayIsoInTokyo,
} from "@/lib/tokyo-date";
import Link from "next/link";

type Search = { from?: string; to?: string };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const sp = (await searchParams) ?? {};
  const from =
    sp.from && isIsoDate(sp.from) ? sp.from : firstDayOfMonthIsoInTokyo();
  const to = sp.to && isIsoDate(sp.to) ? sp.to : todayIsoInTokyo();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AppPageMain>
        <p className="text-neutral-600 dark:text-neutral-400">
          ログインが必要です。
        </p>
      </AppPageMain>
    );
  }

  let ctx;
  let errMsg: string | null = null;
  try {
    ctx = await loadReportContext(supabase, from, to);
  } catch (e) {
    errMsg = e instanceof Error ? e.message : "読み込みに失敗しました";
    ctx = { orders: [], lineRows: [] };
  }

  const sumEx = ctx.orders.reduce((a, o) => a + Number(o.subtotal_ex_tax), 0);
  const sumTax = ctx.orders.reduce((a, o) => a + Number(o.tax_amount), 0);
  const sumInc = ctx.orders.reduce((a, o) => a + Number(o.total_inc_tax), 0);

  const xlsxHref = `/api/reports/export/xlsx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const pdfHref = `/api/reports/export/pdf?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <AppPageMain className="pb-24">
      <header className="border-b border-[var(--border)] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Reports
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
          レポート・エクスポート
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-500">
          期間を指定して集計を確認し、Excel または PDF
          でダウンロードできます（日付境界は Asia/Tokyo）。
        </p>
      </header>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card"
      >
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            開始日
          </label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm dark:bg-[var(--surface-muted)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            終了日
          </label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm dark:bg-[var(--surface-muted)]"
          />
        </div>
        <button
          type="submit"
          className="btn-primary btn-sm"
        >
          表示
        </button>
      </form>

      {errMsg ? (
        <p className="mt-4 text-sm text-red-600">{errMsg}</p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            税抜売上合計
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--foreground)]">
            {formatYen(sumEx)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            税額合計
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--foreground)]">
            {formatYen(sumTax)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            税込売上合計
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--foreground)]">
            {formatYen(sumInc)}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={xlsxHref}
          className="btn-primary"
        >
          Excel ダウンロード
        </a>
        <a
          href={pdfHref}
          className="btn btn-foreground px-5 font-semibold"
        >
          PDF ダウンロード
        </a>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
        >
          ダッシュボード
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            注文一覧（期間内）
          </h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              <th className="px-4 py-2">注文番号</th>
              <th className="px-4 py-2">確定日時</th>
              <th className="px-4 py-2 text-right">税込</th>
            </tr>
          </thead>
          <tbody>
            {ctx.orders.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                  データがありません
                </td>
              </tr>
            ) : (
              ctx.orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-[var(--border)]/70 last:border-0"
                >
                  <td className="px-4 py-2 font-mono text-xs text-[var(--foreground)]">
                    {o.order_number}
                  </td>
                  <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                    {new Date(o.placed_at).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-[var(--foreground)]">
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
