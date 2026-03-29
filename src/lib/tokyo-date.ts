/** 集計の日付境界は Asia/Tokyo（機能設計 §1.3 / 技術仕様 §5） */

const TZ = "Asia/Tokyo";

export function formatDateInTokyo(isoUtc: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoUtc));
}

export function todayIsoInTokyo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function firstDayOfMonthIsoInTokyo(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}-01`;
}

/** 暦日 `from`〜`to`（含む）を Tokyo 0 時基準の UTC 範囲 [start, end) に変換 */
export function tokyoDayRangeUtcIso(from: string, to: string): {
  startIso: string;
  endExclusiveIso: string;
} {
  const startIso = new Date(`${from}T00:00:00+09:00`).toISOString();
  const endTokyoMidnight = new Date(`${to}T00:00:00+09:00`).getTime();
  const endExclusiveIso = new Date(
    endTokyoMidnight + 24 * 60 * 60 * 1000,
  ).toISOString();
  return { startIso, endExclusiveIso };
}

/** 暦日 `from`〜`to`（東京・端点含む）の日数 */
export function daysBetweenInclusiveTokyo(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00+09:00`).getTime();
  const end = new Date(`${to}T00:00:00+09:00`).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

/** 東京暦で `iso` から `delta` 日ずらした YYYY-MM-DD */
export function addCalendarDaysTokyo(iso: string, delta: number): string {
  const t =
    new Date(`${iso}T00:00:00+09:00`).getTime() +
    delta * 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

/** 直前の同長期間（`from` の前日を終端とする） */
export function previousPeriodInclusiveTokyo(
  from: string,
  to: string,
): { from: string; to: string } {
  const n = daysBetweenInclusiveTokyo(from, to);
  const prevTo = addCalendarDaysTokyo(from, -1);
  const prevFrom = addCalendarDaysTokyo(prevTo, -(n - 1));
  return { from: prevFrom, to: prevTo };
}
