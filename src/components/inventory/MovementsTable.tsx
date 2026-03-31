"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type GroupEmbed = {
  name: string | null;
};

type SkuEmbed = {
  sku_code: string;
  jan_code: string;
  name_variant: string | null;
  /** PostgREST が単一でも配列でも返しうる */
  product_groups: GroupEmbed | GroupEmbed[] | null;
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

function groupNameOf(sku: SkuEmbed | null): string | null {
  if (!sku?.product_groups) return null;
  const g = sku.product_groups;
  const row = Array.isArray(g) ? (g[0] ?? null) : g;
  return row?.name ?? null;
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
        className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card"
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
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            開始日
          </label>
          <input
            name="from"
            type="date"
            defaultValue={filters.from}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm dark:bg-[var(--surface-muted)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            終了日
          </label>
          <input
            name="to"
            type="date"
            defaultValue={filters.to}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm dark:bg-[var(--surface-muted)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            理由
          </label>
          <select
            name="reason"
            defaultValue={filters.reason}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm dark:bg-[var(--surface-muted)]"
          >
            <option value="">すべて</option>
            <option value="manual_adjust">手動調整</option>
            <option value="csv_import">CSV 取込</option>
            <option value="barcode_inbound">バーコード入庫</option>
            <option value="order_sale">注文出庫</option>
          </select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            SKU / JAN / グループ名
          </label>
          <input
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="部分一致"
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm dark:bg-[var(--surface-muted)]"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary btn-sm"
        >
          絞り込み
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            <tr>
              <th className="px-3 py-2.5">日時</th>
              <th className="px-3 py-2.5">SKU</th>
              <th className="px-3 py-2.5">JAN</th>
              <th className="px-3 py-2.5">グループ名</th>
              <th className="px-3 py-2.5">理由</th>
              <th className="px-3 py-2.5 text-right">増減</th>
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
                    className="border-b border-[var(--border)]/70 last:border-0"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                      {new Date(m.created_at).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {sku?.sku_code ? (
                        <Link
                          href={`/inventory/sku/${m.sku_id}`}
                          className="font-semibold text-[var(--foreground)] underline-offset-2 hover:underline"
                        >
                          {sku.sku_code}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                      {sku?.jan_code ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                      {groupNameOf(sku) ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]">{label}</td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        m.quantity_delta >= 0
                          ? "text-neutral-700 dark:text-neutral-300"
                          : "text-neutral-500"
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

      <p className="mt-5 text-sm">
        <Link
          href="/inventory"
          className="font-semibold text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
        >
          ← 在庫一覧
        </Link>
      </p>
    </div>
  );
}
