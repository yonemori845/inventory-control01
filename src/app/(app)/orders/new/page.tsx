import { OrderNewClient } from "@/components/orders/OrderNewClient";
import { AppPageMain } from "@/components/layout/app-page";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function OrderNewPage() {
  const supabase = await createServerSupabaseClient();
  const { data: skus, error } = await supabase
    .from("product_skus")
    .select(
      `
      id,
      sku_code,
      jan_code,
      name_variant,
      color,
      size,
      unit_price_ex_tax,
      quantity,
      product_groups (
        group_code,
        name
      )
    `,
    )
    .eq("is_active", true)
    .order("sku_code", { ascending: true });

  if (error) {
    return (
      <AppPageMain>
        <p className="text-red-600">SKU の取得に失敗しました: {error.message}</p>
      </AppPageMain>
    );
  }

  const options = (skus ?? []).map((s) => {
    const pg = Array.isArray(s.product_groups)
      ? s.product_groups[0]
      : s.product_groups;
    return {
      id: s.id,
      sku_code: s.sku_code,
      jan_code: s.jan_code,
      name_variant: s.name_variant,
      color: s.color ?? null,
      size: s.size ?? null,
      group_name: pg?.name ?? "",
      group_code: pg?.group_code ?? "",
      unit_price_ex_tax: Number(s.unit_price_ex_tax),
      quantity: s.quantity,
    };
  });

  return (
    <AppPageMain className="pb-24">
      <header className="border-b border-[var(--border)] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Orders
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
          注文作成
        </h1>
      </header>
      <div className="mt-6">
        <OrderNewClient skus={options} />
      </div>
    </AppPageMain>
  );
}
