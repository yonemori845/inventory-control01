import { OrderNewClient } from "@/components/orders/OrderNewClient";
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
      <main className="p-6">
        <p className="text-red-600">SKU の取得に失敗しました: {error.message}</p>
      </main>
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
    <main className="relative min-h-screen pb-24">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[24rem] w-[24rem] rounded-full bg-slate-300/[0.12] blur-[100px] dark:bg-slate-500/[0.07]" />
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-10">
        <p className="text-xs font-mono text-slate-500">SCR-ORD-NEW</p>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            注文作成
          </h1>
          <Link
            href="/orders"
            className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
          >
            注文一覧
          </Link>
        </div>
        <div className="mt-8">
          <OrderNewClient skus={options} />
        </div>
      </div>
    </main>
  );
}
