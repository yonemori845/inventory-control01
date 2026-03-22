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
