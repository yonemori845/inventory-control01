"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type SkuEmbed = {
  sku_code: string;
  jan_code: string;
  name_variant: string | null;
};

export type MovementRow = {
  id: string;
  quantity_delta: number;
  reason: string;
  created_at: string;
  sku_id: string;
  performed_by: string | null;
  /** PostgREST が単一でも配列でも返しうる */
  product_skus: SkuEmbed | SkuEmbed[] | null;
};

function skuOf(m: MovementRow): SkuEmbed | null {
  const x = m.product_skus;
  if (!x) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

const REASON_LABEL: Record<string, string> = {
  manual_adjust: "手動調整",
  csv_import: "CSV 取込",
  barcode_inbound: "バーコード入庫",
  order_sale: "注文出庫",
};

type Props = {
  rows: MovementRow[];
  filters: {
    from: string;
    to: string;
    reason: string;
    q: string;
  };
};

export function MovementsTable({ rows, filters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(next: Partial<typeof filters>) {
    const p = new URLSearchParams();
    const merged = { ...filters, ...next };
    if (merged.from) p.set("from", merged.from);
    if (merged.to) p.set("to", merged.to);
    if (merged.reason) p.set("reason", merged.reason);
    if (merged.q) p.set("q", merged.q);
    startTransition(() => {
      router.push(`/inventory/movements?${p.toString()}`);
    });
  }

  return (
    <div>
      <form
        className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          apply({
            from: String(fd.get("from") ?? ""),
            to: String(fd.get("to") ?? ""),
            reason: String(fd.get("reason") ?? ""),
            q: String(fd.get("q") ?? ""),
          });
        }}
      >
        <div>
          <label className="block text-xs text-neutral-500">開始日</label>
          <input
            name="from"
            type="date"
            defaultValue={filters.from}
            className="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">終了日</label>
          <input
            name="to"
            type="date"
            defaultValue={filters.to}
            className="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">理由</label>
          <select
            name="reason"
            defaultValue={filters.reason}
            className="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          >
            <option value="">すべて</option>
            <option value="manual_adjust">手動調整</option>
            <option value="csv_import">CSV 取込</option>
            <option value="barcode_inbound">バーコード入庫</option>
            <option value="order_sale">注文出庫</option>
          </select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="block text-xs text-neutral-500">SKU / JAN / 名称</label>
          <input
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="部分一致"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          絞り込み
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-3 py-2">日時</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">JAN</th>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">理由</th>
              <th className="px-3 py-2 text-right">増減</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                  履歴がありません
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const sku = skuOf(m);
                const label = REASON_LABEL[m.reason] ?? m.reason;
                return (
                  <tr
                    key={m.id}
                    className="border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {new Date(m.created_at).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {sku?.sku_code ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {sku?.jan_code ?? "—"}
                    </td>
                    <td className="px-3 py-2">{sku?.name_variant ?? "—"}</td>
                    <td className="px-3 py-2">{label}</td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        m.quantity_delta >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {m.quantity_delta > 0 ? "+" : ""}
                      {m.quantity_delta}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm">
        <Link href="/inventory" className="text-neutral-600 underline dark:text-neutral-400">
          ← 在庫一覧
        </Link>
      </p>
    </div>
  );
}
