export const INVENTORY_CSV_HEADER =
  "group_code,group_name,sku_code,jan_code,name_variant,color,size,quantity,reorder_point,safety_stock,unit_price_ex_tax,is_active,group_description,sort_order";

export type InventoryCsvRow = {
  group_code: string;
  group_name: string;
  sku_code: string;
  jan_code: string;
  name_variant: string;
  color: string;
  size: string;
  quantity: number;
  reorder_point: number;
  safety_stock: number;
  unit_price_ex_tax: number;
  is_active: boolean;
  group_description: string;
  sort_order: number;
};

const COLS = INVENTORY_CSV_HEADER.split(",");

function parseBool(s: string): boolean {
  const v = s.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

export function parseInventoryCsv(text: string):
  | { ok: true; rows: InventoryCsvRow[] }
  | { ok: false; errors: { line: number; message: string }[] } {
  const bomStripped = text.replace(/^\uFEFF/, "");
  const lines = bomStripped.split(/\r?\n/).filter((l) => l.trim() !== "");
  const errors: { line: number; message: string }[] = [];
  if (lines.length === 0) {
    return { ok: false, errors: [{ line: 1, message: "ファイルが空です" }] };
  }

  const header = lines[0].split(",").map((c) => c.trim());
  if (header.join(",") !== COLS.join(",")) {
    return {
      ok: false,
      errors: [
        {
          line: 1,
          message: `ヘッダーがテンプレートと一致しません。先頭行は次の通りにしてください:\n${INVENTORY_CSV_HEADER}`,
        },
      ],
    };
  }

  const rows: InventoryCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    const parts = splitCsvLine(lines[i]);
    if (parts.length !== COLS.length) {
      errors.push({
        line: lineNo,
        message: `列数が ${COLS.length} ではありません（${parts.length} 列）`,
      });
      continue;
    }

    const rec = Object.fromEntries(
      COLS.map((k, j) => [k, parts[j] ?? ""]),
    ) as Record<string, string>;

    const qty = parseInt(rec.quantity, 10);
    const rp = parseInt(rec.reorder_point || "0", 10);
    const ss = parseInt(rec.safety_stock || "0", 10);
    const price = parseFloat(rec.unit_price_ex_tax || "0");
    const sort = parseInt(rec.sort_order || "0", 10);

    if (!rec.group_code?.trim() || !rec.group_name?.trim()) {
      errors.push({ line: lineNo, message: "group_code / group_name が必須です" });
      continue;
    }
    if (!rec.sku_code?.trim() || !rec.jan_code?.trim()) {
      errors.push({ line: lineNo, message: "sku_code / jan_code が必須です" });
      continue;
    }
    if (Number.isNaN(qty) || qty < 0) {
      errors.push({ line: lineNo, message: "quantity は 0 以上の整数" });
      continue;
    }
    if (Number.isNaN(rp) || rp < 0 || Number.isNaN(ss) || ss < 0) {
      errors.push({ line: lineNo, message: "reorder_point / safety_stock が不正" });
      continue;
    }
    if (Number.isNaN(price) || price < 0) {
      errors.push({ line: lineNo, message: "unit_price_ex_tax が不正" });
      continue;
    }
    if (Number.isNaN(sort)) {
      errors.push({ line: lineNo, message: "sort_order が不正" });
      continue;
    }

    rows.push({
      group_code: rec.group_code.trim(),
      group_name: rec.group_name.trim(),
      sku_code: rec.sku_code.trim(),
      jan_code: rec.jan_code.trim(),
      name_variant: (rec.name_variant ?? "").trim(),
      color: (rec.color ?? "").trim(),
      size: (rec.size ?? "").trim(),
      quantity: qty,
      reorder_point: rp,
      safety_stock: ss,
      unit_price_ex_tax: price,
      is_active: parseBool(rec.is_active ?? "true"),
      group_description: (rec.group_description ?? "").trim(),
      sort_order: sort,
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rows };
}

/** カンマ区切り（ダブルクォートでエスケープ） */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function rowsToJsonForRpc(rows: InventoryCsvRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    group_code: r.group_code,
    group_name: r.group_name,
    sku_code: r.sku_code,
    jan_code: r.jan_code,
    name_variant: r.name_variant || null,
    color: r.color || null,
    size: r.size || null,
    quantity: r.quantity,
    reorder_point: r.reorder_point,
    safety_stock: r.safety_stock,
    unit_price_ex_tax: r.unit_price_ex_tax,
    is_active: r.is_active,
    group_description: r.group_description || null,
    sort_order: r.sort_order,
  }));
}
