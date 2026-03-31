import {
  MovementsTable,
  type MovementRow,
} from "@/components/inventory/MovementsTable";
import { AppPageMain } from "@/components/layout/app-page";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  reason?: string;
  q?: string;
}>;

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = {
    from: sp.from ?? "",
    to: sp.to ?? "",
    reason: sp.reason ?? "",
    q: sp.q ?? "",
  };

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("inventory_movements")
    .select(
      `
      id,
      quantity_delta,
      reason,
      created_at,
      sku_id,
      performed_by,
      product_skus (
        sku_code,
        jan_code,
        name_variant,
        product_groups (
          name
        )
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(600);

  if (filters.from) {
    query = query.gte("created_at", `${filters.from}T00:00:00`);
  }
  if (filters.to) {
    query = query.lte("created_at", `${filters.to}T23:59:59.999`);
  }
  if (filters.reason) {
    query = query.eq("reason", filters.reason);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <AppPageMain>
        <p className="text-red-600">取得に失敗: {error.message}</p>
      </AppPageMain>
    );
  }

  let rows = (data ?? []) as unknown as MovementRow[];

  if (filters.q.trim()) {
    const needle = filters.q.trim().toLowerCase();
    rows = rows.filter((m) => {
      const x = m.product_skus;
      const s = !x
        ? null
        : Array.isArray(x)
          ? (x[0] ?? null)
          : x;
      if (!s) return false;
      const pg = s.product_groups;
      const g = !pg
        ? null
        : Array.isArray(pg)
          ? (pg[0] ?? null)
          : pg;
      const groupName = g?.name?.toLowerCase() ?? "";
      return (
        s.sku_code.toLowerCase().includes(needle) ||
        s.jan_code.toLowerCase().includes(needle) ||
        groupName.includes(needle) ||
        (s.name_variant?.toLowerCase().includes(needle) ?? false)
      );
    });
  }

  return (
    <AppPageMain className="pb-24">
      <header className="border-b border-[var(--border)] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Inventory
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
          入出庫履歴
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-500">
          SKU 単位の増減履歴を期間・理由・キーワードで絞り込みます。
        </p>
      </header>
      <div className="mt-6">
        <MovementsTable rows={rows} filters={filters} />
      </div>
    </AppPageMain>
  );
}
