import { INVENTORY_CSV_HEADER } from "@/lib/inventory/csv";
import { NextResponse } from "next/server";

const SAMPLE = [
  "DEMO-G01,デモ親商品A,SKU-A-001,4900000000001,赤・M,red,M,12,5,8,1200,true,,0",
  "DEMO-G01,デモ親商品A,SKU-A-002,4900000000002,青・L,blue,L,3,5,8,1200,true,,0",
].join("\n");

export async function GET() {
  // UTF-8 BOM（Excel で文字化け・1列化しにくくする）
  const body = `\uFEFF${INVENTORY_CSV_HEADER}\n${SAMPLE}\n`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="inventory_template.csv"',
    },
  });
}
