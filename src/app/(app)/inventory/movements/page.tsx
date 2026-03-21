import {
  MovementsTable,
  type MovementRow,
} from "@/components/inventory/MovementsTable";
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
        name_variant
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
      <main className="p-6">
        <p className="text-red-600">取得に失敗: {error.message}</p>
      </main>
    );
  }

  let rows = (data ?? []) as unknown as MovementRow[];

  if (filters.q.trim()) {
    const needle = filters.q.trim().toLowerCase();
    rows = rows.filter((m) => {
      const s = Array.isArray(m.product_skus)
        ? m.product_skus[0]
        : m.product_skus;
      if (!s) return false;
      return (
        s.sku_code.toLowerCase().includes(needle) ||
        s.jan_code.toLowerCase().includes(needle) ||
        (s.name_variant?.toLowerCase().includes(needle) ?? false)
      );
    });
  }

  return (
    <main className="p-6">
      <p className="text-xs font-mono text-neutral-500">SCR-INV-HIST</p>
      <h1 className="mt-1 text-xl font-semibold">入出庫履歴</h1>
      <MovementsTable rows={rows} filters={filters} />
    </main>
  );
}
