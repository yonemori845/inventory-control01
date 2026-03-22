import { formatYen } from "@/lib/pricing";
import { loadReportContext, isIsoDate } from "@/lib/report-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  firstDayOfMonthIsoInTokyo,
  todayIsoInTokyo,
} from "@/lib/tokyo-date";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from") ?? "";
  const toRaw = searchParams.get("to") ?? "";
  const from = isIsoDate(fromRaw) ? fromRaw : firstDayOfMonthIsoInTokyo();
  const to = isIsoDate(toRaw) ? toRaw : todayIsoInTokyo();

  let ctx;
  try {
    ctx = await loadReportContext(supabase, from, to);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new NextResponse(msg, { status: 500 });
  }

  const sumEx = ctx.orders.reduce((a, o) => a + Number(o.subtotal_ex_tax), 0);
  const sumTax = ctx.orders.reduce((a, o) => a + Number(o.tax_amount), 0);
  const sumInc = ctx.orders.reduce((a, o) => a + Number(o.total_inc_tax), 0);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text("売上レポート", 40, 48);
  doc.setFontSize(10);
  doc.text(`期間: ${from} ～ ${to}（Asia/Tokyo）`, 40, 66);
  doc.text(`税抜合計: ${formatYen(sumEx)}`, 40, 82);
  doc.text(`税額合計: ${formatYen(sumTax)}`, 40, 96);
  doc.text(`税込合計: ${formatYen(sumInc)}`, 40, 110);
  doc.text(`注文件数: ${ctx.orders.length}`, 40, 124);

  const orderTable = ctx.orders.map((o) => [
    o.order_number,
    new Date(o.placed_at).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
    }),
    formatYen(Number(o.total_inc_tax)),
  ]);

  autoTable(doc, {
    startY: 140,
    head: [["注文番号", "確定日時", "税込"]],
    body: orderTable.length ? orderTable : [["—", "—", "—"]],
    styles: { font: "helvetica", fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  const buf = doc.output("arraybuffer");
  const filename = `report_${from}_${to}.pdf`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
