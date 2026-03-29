/**
 * template_DB.ods に相当するマッピング（doc/在庫CSVとtemplate_DBの対応.md）に沿い、
 * ラミネーター系商品マスタを 300 SKU 登録する。既存の categories / groups / skus / 注文・履歴は削除。
 *
 * 参照: 商品コード→group_code、商品名→group_name、サイズ→size、JAN→jan_code、
 *       税抜単価→unit_price_ex_tax、SKU 一意→sku_code（商品ID相当）
 *
 * ODS 実体はリポジトリに無い場合があるため、上記ドキュメントと sample_inventory_from_template.csv のルールに準拠する。
 *
 * 必要: .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY
 * 実行: npm run seed:laminator
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const N_SKU = 300;
const SKUS_PER_GROUP = 12;
const N_GROUPS = N_SKU / SKUS_PER_GROUP;

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

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください。",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** EAN-13（12桁 + チェックデジット） */
function ean13FromIndex(i) {
  const num = 459_564_360_000 + i;
  const base12 = String(num).padStart(12, "0").slice(-12);
  let sum = 0;
  for (let d = 0; d < 12; d++) {
    const n = parseInt(base12[d], 10);
    sum += n * (d % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base12 + check;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 親商品（テンプレ「商品」1行相当）。group_code / group_name に対応 */
const LAMINATOR_GROUPS = [
  { code: "LAMI-A4-01", name: "卓上ラミネーター A4 標準ローラー", desc: "A4 対応・一般事務向け。フィルム厚 75〜125μm。" },
  { code: "LAMI-A4-02", name: "卓上ラミネーター A4 静音タイプ", desc: "オフィス向け低騒音設計。" },
  { code: "LAMI-A3-01", name: "業務用ラミネーター A3 2本ローラー", desc: "A3 対応・写真・POP 用。" },
  { code: "LAMI-A3-02", name: "業務用ラミネーター A3 4本ローラー", desc: "仕上がり均一な4本加圧。" },
  { code: "LAMI-A2-01", name: "ワイドフォーマットラミネーター A2", desc: "ポスター・大判出力向け。" },
  { code: "LAMI-B4-01", name: "ラミネーター B4 コンパクト", desc: "教科書・冊子サイズ。" },
  { code: "LAMI-CARD-01", name: "名刺サイズラミネーター", desc: "IC カード・名刺用コンパクト。" },
  { code: "LAMI-ROLL-01", name: "ロールフィルム対応ラミネーター", desc: "連続加工向け。" },
  { code: "LAMI-330-01", name: "ローラー幅330mm 汎用モデル", desc: "幅広フィルム対応。" },
  { code: "LAMI-PRO-01", name: "高速ウォームアップ Pro シリーズ", desc: "短時間立上げ。" },
  { code: "LAMI-PRO-02", name: "コールドモード対応 ハイブリッド", desc: "感熱用コールド設定。" },
  { code: "LAMI-SCH-01", name: "学校・図書館向けラミネーター", desc: "安全カバー付き。" },
  { code: "LAMI-SCH-02", name: "授業用 軽量 A4 モデル", desc: "持ち運びしやすい重量。" },
  { code: "LAMI-SHOP-01", name: "店舗カウンター用 スリム A4", desc: "省スペース。" },
  { code: "LAMI-SHOP-02", name: "店舗用 ハイボリューム A3", desc: "連続運用向け。" },
  { code: "LAMI-FILM-01", name: "100μm専用 エントリーモデル", desc: "薄手フィルム最適化。" },
  { code: "LAMI-FILM-02", name: "125〜150μm 厚手対応", desc: "耐水・耐久重視。" },
  { code: "LAMI-FILM-03", name: "250μm ラミネート対応 業務用", desc: "厚手カード仕上げ。" },
  { code: "LAMI-HEAT-01", name: "温度可変 デジタル表示モデル", desc: "フィルム種別に合わせ微調整。" },
  { code: "LAMI-HEAT-02", name: "2ゾーン加熱 均熱タイプ", desc: "端ムラを低減。" },
  { code: "LAMI-SPD-01", name: "高速ラミネート 60秒起動", desc: "スループット重視。" },
  { code: "LAMI-SPD-02", name: "標準速度 低価格帯", desc: "コスト重視。" },
  { code: "LAMI-REV-01", name: "リバース機能付き", desc: "フィルム詰まり解消。" },
  { code: "LAMI-REV-02", name: "オートリバース＆オフタイマー", desc: "省エネ・安全。" },
  { code: "LAMI-KIT-01", name: "スターターキット（本体＋フィルム同梱）", desc: "初期導入セット。" },
];

const SIZES = ["A4", "A4", "A3", "A3", "A2", "B4", "名刺", "330mm", "A4", "A3", "A4長辺", "B5"];
const NAME_VARIANTS = [
  "100μm推奨",
  "125μm推奨",
  "150μm対応",
  "2本ローラー",
  "4本ローラー",
  "冷却ファン付き",
  "シンプル操作パネル",
  "LCD温度表示",
  "角丸カットガイド付",
  "フィルムセット同梱版",
  "国内電源100V",
  "メンテナンスキット付",
];
const COLORS = ["ホワイト", "ブラック", "シルバー", "グレー", "ネイビー"];

function tierForSkuIndex(i) {
  if (i <= 22) return "stockout";
  if (i <= 52) return "below_safety";
  if (i <= 92) return "reorder_only";
  return "normal";
}

function qtyRpSsForTier(tier, i, rand) {
  if (tier === "stockout") {
    return { qty: 0, reorder_point: 6, safety_stock: 10 };
  }
  if (tier === "below_safety") {
    const safety_stock = 16 + Math.floor(rand() * 6);
    const qty = Math.max(1, safety_stock - 2 - Math.floor(rand() * 3));
    const reorder_point = Math.max(6, qty - 2);
    return { qty, reorder_point, safety_stock };
  }
  if (tier === "reorder_only") {
    const safety_stock = 12;
    const reorder_point = 44 + Math.floor(rand() * 8);
    const qty = 22 + Math.floor(rand() * 8);
    return { qty, reorder_point, safety_stock };
  }
  const safety_stock = 12 + Math.floor(rand() * 14);
  const reorder_point = safety_stock + 8 + Math.floor(rand() * 28);
  const qty = reorder_point + 20 + Math.floor(rand() * 140);
  return { qty, reorder_point, safety_stock };
}

function priceForSize(size, rand) {
  const base =
    size === "A2"
      ? 72000
      : size === "A3" || size === "330mm"
        ? 42000
        : size === "名刺"
          ? 9800
          : 19800;
  return base + Math.floor(rand() * 12000) - 4000;
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
  const rand = mulberry32(20260401);

  if (LAMINATOR_GROUPS.length < N_GROUPS) {
    throw new Error(`LAMINATOR_GROUPS は ${N_GROUPS} 件以上必要です`);
  }

  console.log("業務データを削除しています…");
  await deleteAllBusinessData();

  const categoryId = crypto.randomUUID();
  const { error: catErr } = await supabase.from("categories").insert({
    id: categoryId,
    name: "ラミネーター・事務機器",
    parent_id: null,
  });
  if (catErr) throw new Error(`categories: ${catErr.message}`);

  const groupIds = [];
  const groupRows = [];
  for (let g = 0; g < N_GROUPS; g++) {
    const meta = LAMINATOR_GROUPS[g];
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
  let i = 0;
  for (let g = 0; g < N_GROUPS; g++) {
    for (let v = 0; v < SKUS_PER_GROUP; v++) {
      i += 1;
      const tier = tierForSkuIndex(i);
      const { qty, reorder_point, safety_stock } = qtyRpSsForTier(tier, i, rand);
      const size = SIZES[v % SIZES.length];
      const name_variant = NAME_VARIANTS[v % NAME_VARIANTS.length];
      const color = COLORS[Math.floor(rand() * COLORS.length)];
      const sku_code = `LA-${String(g + 1).padStart(2, "0")}-${String(v + 1).padStart(3, "0")}`;
      const jan = ean13FromIndex(i);

      skuRows.push({
        product_group_id: groupIds[g],
        sku_code,
        jan_code: jan,
        name_variant,
        color,
        size,
        quantity: qty,
        reorder_point,
        safety_stock,
        unit_price_ex_tax: priceForSize(size, rand),
        is_active: true,
      });
    }
  }

  const { error: skuErr } = await supabase.from("product_skus").insert(skuRows);
  if (skuErr) throw new Error(`product_skus: ${skuErr.message}`);

  const { data: state } = await supabase
    .from("product_skus")
    .select("sku_code, quantity, reorder_point, safety_stock");
  const isAlert = (r) => {
    const q = Number(r.quantity);
    const rp = Number(r.reorder_point);
    const ss = Number(r.safety_stock);
    return q <= rp || q < ss;
  };
  const alerts = (state ?? []).filter(isAlert);

  console.log(`ラミネーター SKU ${skuRows.length} 件を登録しました（親商品 ${N_GROUPS}）。`);
  console.log("--- アラート条件（数量≤発注点 または 数量<安全在庫）---");
  console.log(`該当: ${alerts.length} 件（在庫0含む）`);

  const zeros = (state ?? []).filter((r) => Number(r.quantity) === 0).length;
  console.log(`在庫 0: ${zeros} 件`);

  const { count: cG } = await supabase
    .from("product_groups")
    .select("*", { count: "exact", head: true });
  const { count: cS } = await supabase
    .from("product_skus")
    .select("*", { count: "exact", head: true });

  console.log("--- 確認 ---");
  console.log("product_groups:", cG);
  console.log("product_skus:", cS);
  console.log("完了（注文データは入れていません）。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
