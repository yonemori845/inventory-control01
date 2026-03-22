"use server";

import { DEFAULT_CONSUMPTION_TAX_RATE } from "@/lib/pricing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type PlaceOrderLine = { sku_id: string; quantity: number };

export type PlaceOrderResult =
  | { ok: true; orderId: string }
  | {
      ok: false;
      message: string;
      shortage?: {
        sku_code: string;
        requested: number;
        available: number;
        reason?: string;
      }[];
    };

export async function placeOrderAction(
  lines: PlaceOrderLine[],
): Promise<PlaceOrderResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "未ログインです。" };
  }

  if (!lines.length) {
    return { ok: false, message: "明細がありません。" };
  }

  const { data: orderId, error } = await supabase.rpc("place_order", {
    p_lines: lines,
    p_tax_rate: DEFAULT_CONSUMPTION_TAX_RATE,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.startsWith("INSUFFICIENT_STOCK:")) {
      const raw = msg.slice("INSUFFICIENT_STOCK:".length).trim();
      try {
        const parsed = JSON.parse(raw) as unknown;
        const shortage = Array.isArray(parsed)
          ? parsed.map((x) => ({
              sku_code: String((x as { sku_code?: string }).sku_code ?? ""),
              requested: Number((x as { requested?: number }).requested),
              available: Number((x as { available?: number }).available),
              reason: (x as { reason?: string }).reason,
            }))
          : [];
        return {
          ok: false,
          message: "在庫が不足しているため注文できません。",
          shortage,
        };
      } catch {
        return { ok: false, message: "在庫が不足しているため注文できません。" };
      }
    }
    return { ok: false, message: msg || "注文の確定に失敗しました。" };
  }

  if (!orderId) {
    return { ok: false, message: "注文 ID を取得できませんでした。" };
  }

  const id = String(orderId);
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/reports");
  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");

  return { ok: true, orderId: id };
}
