import { OrderNewClient } from "@/components/orders/OrderNewClient";
import { AppPageMain } from "@/components/layout/app-page";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function OrderNewPage() {
  const supabase = await createServerSupabaseClient();
  const { data: skus, error } = await supabase
    .from("product_skus")
    .select(
      "id, sku_code, jan_code, name_variant, unit_price_ex_tax, quantity",
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

  const options = (skus ?? []).map((s) => ({
    id: s.id,
    sku_code: s.sku_code,
    jan_code: s.jan_code,
    name_variant: s.name_variant,
    unit_price_ex_tax: Number(s.unit_price_ex_tax),
    quantity: s.quantity,
  }));

  return (
    <AppPageMain className="pb-24">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Orders
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
            注文作成
          </h1>
        </div>
        <Link
          href="/orders"
          className="text-sm font-semibold text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
        >
          注文一覧
        </Link>
      </header>
      <div className="mt-6">
        <OrderNewClient skus={options} />
      </div>
    </AppPageMain>
  );
}
