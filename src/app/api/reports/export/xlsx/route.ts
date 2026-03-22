import { loadReportContext, isIsoDate } from "@/lib/report-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  firstDayOfMonthIsoInTokyo,
  todayIsoInTokyo,
} from "@/lib/tokyo-date";
import * as XLSX from "xlsx";
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

  const wb = XLSX.utils.book_new();

  const summary = [
    { key: "期間（開始）", value: from },
    { key: "期間（終了）", value: to },
    {
      key: "税抜売上合計",
      value: ctx.orders.reduce((a, o) => a + Number(o.subtotal_ex_tax), 0),
    },
    {
      key: "税額合計",
      value: ctx.orders.reduce((a, o) => a + Number(o.tax_amount), 0),
    },
    {
      key: "税込売上合計",
      value: ctx.orders.reduce((a, o) => a + Number(o.total_inc_tax), 0),
    },
    { key: "注文件数", value: ctx.orders.length },
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summary),
    "サマリー",
  );

  const orderRows = ctx.orders.map((o) => ({
    注文番号: o.order_number,
    確定日時: o.placed_at,
    税抜小計: Number(o.subtotal_ex_tax),
    税額: Number(o.tax_amount),
    税込合計: Number(o.total_inc_tax),
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(orderRows.length ? orderRows : [{ 注文番号: "—" }]),
    "注文",
  );

  const lineRows = ctx.lineRows.map((r) => ({
    order_id: r.order_id,
    sku_code: r.sku_code,
    数量: r.quantity,
    税抜小計: r.line_subtotal_ex_tax,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(lineRows.length ? lineRows : [{ sku_code: "—" }]),
    "明細",
  );

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `report_${from}_${to}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
