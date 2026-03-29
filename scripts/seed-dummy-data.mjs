/**
 * 業務データを削除し、ダミー在庫 200 SKU・過去1か月に均等分布した注文 100 件を投入する。
 *
 * 必要: .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY
 *
 * 実行: node scripts/seed-dummy-data.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TAX_RATE = Number(process.env.NEXT_PUBLIC_DEFAULT_TAX_RATE ?? 0.1);

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください。",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function lineSubtotalExTax(unit, qty) {
  return Math.round(Number(unit) * qty);
}

function lineTaxFromSubtotal(sub) {
  return Math.round(sub * TAX_RATE);
}

function orderTotalsFromLines(lines) {
  let subtotalExTax = 0;
  let taxAmount = 0;
  for (const line of lines) {
    const unit = Number(
      line.unitPriceExTax ?? line.unit_price_ex_tax ?? 0,
    );
    const quantity = Number(line.quantity ?? 0);
    const sub = lineSubtotalExTax(unit, quantity);
    subtotalExTax += sub;
    taxAmount += lineTaxFromSubtotal(sub);
  }
  return {
    subtotalExTax,
    taxAmount,
    totalIncTax: subtotalExTax + taxAmount,
  };
}

/** 擬似乱数（再現しやすい固定シード） */
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function deleteAllBusinessData() {
  const tables = [
    "order_lines",
    "orders",
    "inventory_movements",
    "product_skus",
    "product_groups",
    "categories",
  ];
  for (const t of tables) {
    const { error } = await supabase
      .from(t)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`delete ${t}: ${error.message}`);
  }
}

async function main() {
  const rand = mulberry32(20260329);
  /** 並列実行・再実行時の order_number 重複を避ける */
  const runSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);

  console.log("既存の categories / product_groups / product_skus / movements / orders を削除しています…");
  await deleteAllBusinessData();

  const categoryId = crypto.randomUUID();
  const { error: catErr } = await supabase.from("categories").insert({
    id: categoryId,
    name: "ダミー商品カテゴリ",
    parent_id: null,
  });
  if (catErr) throw new Error(`categories: ${catErr.message}`);

  const nGroups = 25;
  const skusPerGroup = 8;
  const groupIds = [];
  const groupRows = [];

  for (let g = 0; g < nGroups; g++) {
    const gid = crypto.randomUUID();
    groupIds.push(gid);
    groupRows.push({
      id: gid,
      group_code: `DMY-G${String(g + 1).padStart(2, "0")}`,
      name: `ダミー商品グループ ${g + 1}`,
      description: `シード用 ${g + 1}/${nGroups}`,
      category_id: categoryId,
      sort_order: g,
      is_active: true,
    });
  }

  const { error: gErr } = await supabase.from("product_groups").insert(groupRows);
  if (gErr) throw new Error(`product_groups: ${gErr.message}`);

  const skuRows = [];
  let skuIndex = 0;
  for (let g = 0; g < nGroups; g++) {
    for (let s = 0; s < skusPerGroup; s++) {
      skuIndex += 1;
      const unit = 800 + Math.floor(rand() * 4200);
      const qty = 120 + Math.floor(rand() * 380);
      const rp = 5 + Math.floor(rand() * 25);
      const safety = 3 + Math.floor(rand() * 15);
      skuRows.push({
        product_group_id: groupIds[g],
        sku_code: `DMY-SKU-${String(skuIndex).padStart(5, "0")}`,
        jan_code: String(4519900000000 + skuIndex),
        name_variant: `バリエーション ${s + 1}`,
        color: ["BK", "NV", "GY", "WH", "BE", "RD"][s % 6],
        size: ["S", "M", "L", "XL"][s % 4],
        quantity: qty,
        reorder_point: rp,
        safety_stock: safety,
        unit_price_ex_tax: unit,
        is_active: true,
      });
    }
  }

  const { data: insertedSkus, error: skuErr } = await supabase
    .from("product_skus")
    .insert(skuRows)
    .select("id, sku_code, unit_price_ex_tax, quantity");

  if (skuErr) throw new Error(`product_skus: ${skuErr.message}`);
  console.log(`在庫 SKU ${insertedSkus.length} 件を登録しました。`);

  const skus = insertedSkus;
  const stock = new Map(skus.map((x) => [x.id, x.quantity]));

  const now = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const tStart = now - monthMs;

  const nOrders = 100;
  for (let i = 0; i < nOrders; i++) {
    const t = new Date(tStart + ((i + 0.5) / nOrders) * monthMs).toISOString();

    const nLines = 1 + Math.floor(rand() * 3);
    const shuffled = [...skus].sort(() => rand() - 0.5);
    const lines = [];
    for (let L = 0; L < nLines && L < shuffled.length; L++) {
      const pick = shuffled[L];
      const q = 1 + Math.floor(rand() * 4);
      const avail = stock.get(pick.id) ?? 0;
      if (avail < 1) continue;
      const qty = Math.min(q, avail);
      lines.push({
        sku_id: pick.id,
        quantity: Math.max(1, qty),
        unitPriceExTax: Number(pick.unit_price_ex_tax),
      });
    }
    if (lines.length === 0) {
      const pick = shuffled[0];
      const qty = Math.min(2, Math.max(1, stock.get(pick.id) ?? 1));
      lines.push({
        sku_id: pick.id,
        quantity: qty,
        unitPriceExTax: Number(pick.unit_price_ex_tax),
      });
    }

    for (const ln of lines) {
      const cur = stock.get(ln.sku_id) ?? 0;
      if (cur < ln.quantity) ln.quantity = Math.max(1, cur);
    }

    const totals = orderTotalsFromLines(lines);
    const orderNumber = `ORD-DUMMY-${String(i + 1).padStart(5, "0")}-${runSuffix}`;

    const { data: ord, error: oErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        placed_at: t,
        subtotal_ex_tax: totals.subtotalExTax,
        tax_amount: totals.taxAmount,
        total_inc_tax: totals.totalIncTax,
        created_by: null,
      })
      .select("id")
      .single();

    if (oErr) throw new Error(`orders ${i}: ${oErr.message}`);
    const orderId = ord.id;

    const lineRows = lines.map((ln) => {
      const unit = Number(ln.unitPriceExTax);
      return {
        order_id: orderId,
        sku_id: ln.sku_id,
        quantity: ln.quantity,
        unit_price_ex_tax: unit,
        line_subtotal_ex_tax: lineSubtotalExTax(unit, ln.quantity),
      };
    });
    const { error: olErr } = await supabase.from("order_lines").insert(lineRows);
    if (olErr) throw new Error(`order_lines: ${olErr.message}`);

    for (const ln of lines) {
      const prev = stock.get(ln.sku_id) ?? 0;
      const next = prev - ln.quantity;
      stock.set(ln.sku_id, next);
    }

    const updateResults = await Promise.all(
      lines.map((ln) =>
        supabase
          .from("product_skus")
          .update({ quantity: stock.get(ln.sku_id) })
          .eq("id", ln.sku_id),
      ),
    );
    const upFail = updateResults.find((r) => r.error);
    if (upFail?.error) throw new Error(`sku update: ${upFail.error.message}`);

    const mvRows = lines.map((ln) => ({
      sku_id: ln.sku_id,
      quantity_delta: -ln.quantity,
      reason: "order_sale",
      reference_type: "order",
      reference_id: orderId,
      performed_by: null,
      created_at: t,
    }));
    const { error: mvErr } = await supabase.from("inventory_movements").insert(mvRows);
    if (mvErr) throw new Error(`inventory_movements: ${mvErr.message}`);
  }

  console.log(`注文 ${nOrders} 件を登録しました（過去約30日に均等配置の placed_at）。`);

  const { count: cSku } = await supabase
    .from("product_skus")
    .select("*", { count: "exact", head: true });
  const { count: cOrd } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });
  const { count: cOl } = await supabase
    .from("order_lines")
    .select("*", { count: "exact", head: true });
  const { count: cMv } = await supabase
    .from("inventory_movements")
    .select("*", { count: "exact", head: true });

  console.log("--- 確認 ---");
  console.log("product_skus:", cSku);
  console.log("orders:", cOrd);
  console.log("order_lines:", cOl);
  console.log("inventory_movements:", cMv);
  console.log("完了しました。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
