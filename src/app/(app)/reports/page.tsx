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
      <main className="p-6">
        <p>ログインが必要です。</p>
      </main>
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
    <main className="relative min-h-screen pb-24">
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-10">
        <p className="text-xs font-mono text-slate-500">SCR-RPT</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
          レポート・エクスポート
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          期間を指定して集計を確認し、Excel または PDF
          でダウンロードできます（日付境界は Asia/Tokyo）。
        </p>

        <form
          method="get"
          className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              開始日
            </label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-10 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              終了日
            </label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-10 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            表示
          </button>
        </form>

        {errMsg ? (
          <p className="mt-4 text-sm text-red-600">{errMsg}</p>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase text-slate-500">
              税抜売上合計
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums">
              {formatYen(sumEx)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase text-slate-500">
              税額合計
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums">
              {formatYen(sumTax)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase text-slate-500">
              税込売上合計
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums">
              {formatYen(sumInc)}
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href={xlsxHref}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Excel ダウンロード
          </a>
          <a
            href={pdfHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold dark:border-slate-600"
          >
            PDF ダウンロード
          </a>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
          >
            ダッシュボード
          </Link>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              注文一覧（期間内）
            </h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                <th className="px-4 py-2">注文番号</th>
                <th className="px-4 py-2">確定日時</th>
                <th className="px-4 py-2 text-right">税込</th>
              </tr>
            </thead>
            <tbody>
              {ctx.orders.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    データがありません
                  </td>
                </tr>
              ) : (
                ctx.orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-100 dark:border-slate-800/80"
                  >
                    <td className="px-4 py-2 font-mono text-xs">{o.order_number}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {new Date(o.placed_at).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
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
