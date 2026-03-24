import type { InventoryCsvRow } from "@/lib/inventory/csv";
import { INVENTORY_CSV_HEADER } from "@/lib/inventory/csv";

/** CSV 1フィールドを RFC 4180 風にエスケープ（取込側の splitCsvLine と対になる） */
export function escapeCsvField(raw: string): string {
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function rowToLine(r: InventoryCsvRow): string {
  const fields: string[] = [
    r.group_code,
    r.group_name,
    r.sku_code,
    r.jan_code,
    r.name_variant ?? "",
    r.color ?? "",
    r.size ?? "",
    String(r.quantity),
    String(r.reorder_point),
    String(r.safety_stock),
    String(r.unit_price_ex_tax),
    r.is_active ? "true" : "false",
    r.group_description ?? "",
    String(r.sort_order),
  ].map((x) => escapeCsvField(x));
  return fields.join(",");
}

/** UTF-8 BOM 付き（Excel で列が1つにまとまるのを防ぎやすくする） */
export function buildInventoryCsvDocument(rows: InventoryCsvRow[]): string {
  const lines = [INVENTORY_CSV_HEADER, ...rows.map(rowToLine)];
  return `\uFEFF${lines.join("\n")}\n`;
}
