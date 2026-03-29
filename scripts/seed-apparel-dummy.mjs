/**
 * 業務データを全削除し、アパレル（衣類）向けダミー在庫 300 SKU・過去約1か月に均等分布した注文 100 件を投入。
 * 在庫0・安全在庫未満・発注点のみアラートが混在するよう SKU 初期値と注文の偏りで調整。
 * 親商品名は小売の一般的なカテゴリ表現（シャツ・パンツ・アウター等）をベースに構成。
 *
 * 必要: .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY
 * 実行: npm run seed:apparel
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

const N_SKUS = 300;
const N_ORDERS = 100;
const N_GROUPS = 25;
const SKUS_PER_GROUP = 12;

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

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** EAN-13（日本の JAN 13 桁）チェックデジット */
function jan13FromBase12(base12) {
  const s = String(base12).padStart(12, "0").slice(-12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(s[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return s + check;
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

async function insertChunked(table, rows, chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await supabase.from(table).insert(slice);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/**
 * 親商品（アパレル小売でよくあるカテゴリ名・シリーズ風の呼び方）
 * ※実在の商標・商品名の転載ではなく、授業用ダミーとしての一般的表現。
 */
const APPAREL_GROUPS = [
  {
    code: "APP-01",
    name: "オックスフォードシャツ（レギュラーカラー）",
    desc: "通年使える定番コットンシャツ。ビジネスカジュアル向け。",
  },
  {
    code: "APP-02",
    name: "ギンガムチェックシャツ",
    desc: "春夏向けの清涼感のあるチェック柄シャツ。",
  },
  {
    code: "APP-03",
    name: "カジュアルクルーネックTシャツ",
    desc: "綿混のベーシック半袖。デイリーユース。",
  },
  {
    code: "APP-04",
    name: "デニムジャケット（ルーズフィット）",
    desc: "羽織りとして使いやすいライトアウター。",
  },
  {
    code: "APP-05",
    name: "形態安定 長袖ワイシャツ",
    desc: "アイロン負担を抑えたビジネス向け長袖。",
  },
  {
    code: "APP-06",
    name: "スキニーフィットジーンズ",
    desc: "ストレッチ入りの細身デニム。",
  },
  {
    code: "APP-07",
    name: "イージーケア テーパードスラックス",
    desc: "オフィスにも合うテーパードシルエットのスラックス。",
  },
  {
    code: "APP-08",
    name: "ウルトラライトダウンジャケット",
    desc: "軽量で持ち運びしやすいダウンアウター。",
  },
  {
    code: "APP-09",
    name: "ヒートテック クルーネック（極暖）",
    desc: "防寒インナー。冬場の重ね着に。",
  },
  {
    code: "APP-10",
    name: "吸汗速乾 ポロシャツ",
    desc: "スポーツ・ゴルフにも使えるドライ系ポロ。",
  },
  {
    code: "APP-11",
    name: "チノショートパンツ",
    desc: "夏のカジュアル向けショーツ。",
  },
  {
    code: "APP-12",
    name: "スウェットプルオーバーパーカー",
    desc: "裏起毛のフーディ。春秋の定番。",
  },
  {
    code: "APP-13",
    name: "モールスキンカバーオール",
    desc: "ワークテイストのジャケット。",
  },
  {
    code: "APP-14",
    name: "ワイドテーパードチノパンツ",
    desc: "ゆったりシルエットのチノ。",
  },
  {
    code: "APP-15",
    name: "コンパクトジャケット（撥水）",
    desc: "小雨に強いショート丈アウター。",
  },
  {
    code: "APP-16",
    name: "リブクルーネック長袖Tシャツ",
    desc: "レイヤード用の薄手ロンT。",
  },
  {
    code: "APP-17",
    name: "ストレッチスリムジーンズ",
    desc: "動きやすいストレッチデニム。",
  },
  {
    code: "APP-18",
    name: "ミドルゲージニットカーディガン",
    desc: "オフィスでも着られるニット羽織り。",
  },
  {
    code: "APP-19",
    name: "ドライEX 半袖Tシャツ",
    desc: "速乾性の高いスポーツカジュアル向け。",
  },
  {
    code: "APP-20",
    name: "コットンブロード レギュラーシャツ",
    desc: "さらりとした肌触りの長袖シャツ。",
  },
  {
    code: "APP-21",
    name: "テーパードアンクルパンツ",
    desc: "足首が見える丈のスラックス・カジュアル両用。",
  },
  {
    code: "APP-22",
    name: "フリースジップジャケット",
    desc: "アウトドア・ルームウェアにも。",
  },
  {
    code: "APP-23",
    name: "タンクトップ（インナー）",
    desc: "重ね着用のノースリーブ。",
  },
  {
    code: "APP-24",
    name: "カーゴパンツ（イージー）",
    desc: "ポケット多めのリラックスパンツ。",
  },
  {
    code: "APP-25",
    name: "フランネルチェックシャツ",
    desc: "秋冬向けの温かみのあるネルシャツ。",
  },
];

const VARIANTS = [
  "定番",
  "スリム",
  "レギュラー",
  "ルーズ",
  "ショート丈",
  "ロング丈",
  "無地",
  "ボーダー",
  "刺繍ワンポイント",
  "プリント",
  "UVカット",
  "吸水速乾",
];

const COLORS = [
  "ホワイト",
  "ブラック",
  "ネイビー",
  "チャコール",
  "ベージュ",
  "オリーブ",
  "ワインレッド",
  "サックス",
  "ブラウン",
  "グレー",
  "アイボリー",
  "カーキ",
];

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

function skuTier(skuIndex) {
  if (skuIndex <= 15) return "stockout";
  if (skuIndex <= 45) return "below_safety";
  if (skuIndex <= 75) return "reorder_only";
  return "normal";
}

function buildSkuRow(product_group_id, skuIndex, rand, variantIdx) {
  const tier = skuTier(skuIndex);
  const unit = 490 + Math.floor(rand() * 11500);
  let qty;
  let reorder_point;
  let safety_stock;

  if (tier === "stockout") {
    qty = 6 + Math.floor(rand() * 18);
    safety_stock = 12;
    reorder_point = 10;
  } else if (tier === "below_safety") {
    qty = 55 + Math.floor(rand() * 45);
    safety_stock = 48;
    reorder_point = 22;
  } else if (tier === "reorder_only") {
    qty = 48 + Math.floor(rand() * 42);
    safety_stock = 14;
    reorder_point = 52;
  } else {
    qty = 120 + Math.floor(rand() * 380);
    safety_stock = 20 + Math.floor(rand() * 25);
    reorder_point = 45 + Math.floor(rand() * 40);
  }

  const g = Math.floor((skuIndex - 1) / SKUS_PER_GROUP);
  const v = VARIANTS[variantIdx % VARIANTS.length];
  const c = COLORS[(skuIndex + variantIdx) % COLORS.length];
  const z = SIZES[(skuIndex - 1) % SIZES.length];

  return {
    product_group_id,
    sku_code: `APP-${String(g + 1).padStart(2, "0")}-${String((skuIndex - 1) % SKUS_PER_GROUP + 1).padStart(3, "0")}`,
    jan_code: jan13FromBase12(451090000000 + skuIndex),
    name_variant: v,
    color: c,
    size: z,
    quantity: qty,
    reorder_point,
    safety_stock,
    unit_price_ex_tax: unit,
    is_active: true,
  };
}

function pickSkuWeighted(available, stock, rand, orderIndex, tierSets) {
  if (available.length === 0) return null;
  const { stockoutIds, belowIds, reorderIds } = tierSets;
  const early = orderIndex < 35;
  const mid = orderIndex < 70;

  const pool = [];
  for (const s of available) {
    let w = 1;
    const id = s.id;
    if (early && stockoutIds.has(id)) w = 22;
    else if (mid && belowIds.has(id)) w = 8;
    else if (reorderIds.has(id)) w = 4;
    pool.push({ s, w });
  }
  let total = pool.reduce((a, b) => a + b.w, 0);
  let r = rand() * total;
  for (const { s, w } of pool) {
    r -= w;
    if (r <= 0) return s;
  }
  return pool[pool.length - 1].s;
}

async function main() {
  const rand = mulberry32(202603291);
  const runSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);

  console.log(
    "既存の categories / product_groups / product_skus / movements / orders を削除しています…",
  );
  await deleteAllBusinessData();

  const categoryId = crypto.randomUUID();
  const { error: catErr } = await supabase.from("categories").insert({
    id: categoryId,
    name: "アパレル・衣料",
    parent_id: null,
  });
  if (catErr) throw new Error(`categories: ${catErr.message}`);

  const groupIds = [];
  const groupRows = [];

  for (let g = 0; g < N_GROUPS; g++) {
    const meta = APPAREL_GROUPS[g];
    const gid = crypto.randomUUID();
    groupIds.push(gid);
    groupRows.push({
      id: gid,
      group_code: meta.code,
      name: meta.name,
      description: meta.desc,
      category_id: categoryId,
      sort_order: g,
      is_active: true,
    });
  }

  const { error: gErr } = await supabase.from("product_groups").insert(groupRows);
  if (gErr) throw new Error(`product_groups: ${gErr.message}`);

  const skuRows = [];
  let skuIndex = 0;
  for (let g = 0; g < N_GROUPS; g++) {
    for (let s = 0; s < SKUS_PER_GROUP; s++) {
      skuIndex += 1;
      skuRows.push(buildSkuRow(groupIds[g], skuIndex, rand, s));
    }
  }

  if (skuRows.length !== N_SKUS) {
    throw new Error(`SKU 件数不一致: ${skuRows.length}`);
  }

  const { data: insertedSkus, error: skuErr } = await supabase
    .from("product_skus")
    .insert(skuRows)
    .select("id, sku_code, unit_price_ex_tax, quantity");

  if (skuErr) throw new Error(`product_skus: ${skuErr.message}`);
  console.log(`在庫 SKU ${insertedSkus.length} 件を登録しました（アパレル親商品 ${N_GROUPS}）。`);

  const skus = insertedSkus;
  const stock = new Map(skus.map((x) => [x.id, x.quantity]));

  const stockoutIds = new Set(
    skus.filter((_, i) => skuTier(i + 1) === "stockout").map((s) => s.id),
  );
  const belowIds = new Set(
    skus.filter((_, i) => skuTier(i + 1) === "below_safety").map((s) => s.id),
  );
  const reorderIds = new Set(
    skus.filter((_, i) => skuTier(i + 1) === "reorder_only").map((s) => s.id),
  );
  const tierSets = { stockoutIds, belowIds, reorderIds };

  const now = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const tStart = now - monthMs;

  const pending = [];
  const nOrders = N_ORDERS;

  for (let i = 0; i < nOrders; i++) {
    const t = new Date(tStart + ((i + 0.5) / nOrders) * monthMs).toISOString();

    const nLines = 1 + Math.floor(rand() * 3);
    const available = skus.filter((s) => (stock.get(s.id) ?? 0) > 0);

    const lines = [];
    const used = new Set();

    for (let L = 0; L < nLines; L++) {
      const pool = available.filter((s) => !used.has(s.id));
      if (pool.length === 0) break;
      const pick = pickSkuWeighted(pool, stock, rand, i, tierSets);
      if (!pick) break;
      used.add(pick.id);

      const q = 1 + Math.floor(rand() * 8);
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
      const pick = available[0] ?? skus[0];
      const qty = Math.min(4, Math.max(1, stock.get(pick.id) ?? 1));
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
    const orderNumber = `ORD-APP-${String(i + 1).padStart(4, "0")}-${runSuffix}`;

    for (const ln of lines) {
      const prev = stock.get(ln.sku_id) ?? 0;
      const next = prev - ln.quantity;
      stock.set(ln.sku_id, next);
    }

    pending.push({ t, lines, totals, orderNumber });
  }

  const orderPayloads = pending.map((p) => ({
    order_number: p.orderNumber,
    placed_at: p.t,
    subtotal_ex_tax: p.totals.subtotalExTax,
    tax_amount: p.totals.taxAmount,
    total_inc_tax: p.totals.totalIncTax,
    created_by: null,
  }));

  const { data: ordersIns, error: batchO } = await supabase
    .from("orders")
    .insert(orderPayloads)
    .select("id");

  if (batchO || !ordersIns?.length) {
    throw new Error(`orders batch: ${batchO?.message ?? "no rows"}`);
  }

  const lineBatch = [];
  const mvBatch = [];

  for (let i = 0; i < ordersIns.length; i++) {
    const orderId = ordersIns[i].id;
    const p = pending[i];
    for (const ln of p.lines) {
      const unit = Number(ln.unitPriceExTax);
      lineBatch.push({
        order_id: orderId,
        sku_id: ln.sku_id,
        quantity: ln.quantity,
        unit_price_ex_tax: unit,
        line_subtotal_ex_tax: lineSubtotalExTax(unit, ln.quantity),
      });
      mvBatch.push({
        sku_id: ln.sku_id,
        quantity_delta: -ln.quantity,
        reason: "order_sale",
        reference_type: "order",
        reference_id: orderId,
        performed_by: null,
        created_at: p.t,
      });
    }
  }

  await insertChunked("order_lines", lineBatch);
  await insertChunked("inventory_movements", mvBatch);

  const upd = await Promise.all(
    [...stock.entries()].map(([id, quantity]) =>
      supabase.from("product_skus").update({ quantity }).eq("id", id),
    ),
  );
  const upFail = upd.find((r) => r.error);
  if (upFail?.error) throw new Error(`sku final update: ${upFail.error.message}`);

  console.log(
    `注文 ${nOrders} 件を登録しました（過去約30日に均等配置、明細 ${lineBatch.length} 行）。`,
  );

  const zero = [...stock.values()].filter((q) => q === 0).length;

  const { data: allSkuState } = await supabase
    .from("product_skus")
    .select("sku_code, quantity, reorder_point, safety_stock");
  const isAlert = (s) => {
    const q = Number(s.quantity);
    const rp = Number(s.reorder_point);
    const ss = Number(s.safety_stock);
    return q <= rp || q < ss;
  };
  const alerts = (allSkuState ?? [])
    .filter(isAlert)
    .sort((a, b) => a.quantity - b.quantity);

  console.log("--- 在庫サマリ（登録後）---");
  console.log("在庫 0 の SKU 数:", zero);
  console.log("アラート条件合致 SKU 数:", alerts.length);
  if (alerts.length) {
    console.log("アラート例（在庫の少ない順・最大15件）:");
    for (const r of alerts.slice(0, 15)) {
      console.log(
        `  ${r.sku_code} qty=${r.quantity} RP=${r.reorder_point} SS=${r.safety_stock}`,
      );
    }
  }

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
