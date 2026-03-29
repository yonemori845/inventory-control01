/** 機能設計 §4.7: quantity <= reorder_point または quantity < safety_stock */

export function isInventoryAlert(
  quantity: number,
  reorderPoint: number,
  safetyStock: number,
): boolean {
  return quantity <= reorderPoint || quantity < safetyStock;
}

/** UI 用：在庫 0 は強調（赤系）、安全在庫未満は注意（黄系）、それ以外のアラートはやや弱い黄系 */
export type InventoryAlertLevel =
  | "stockout"
  | "below_safety"
  | "reorder_only";

export function getInventoryAlertLevel(
  quantity: number,
  reorderPoint: number,
  safetyStock: number,
): InventoryAlertLevel | null {
  if (!isInventoryAlert(quantity, reorderPoint, safetyStock)) return null;
  if (quantity === 0) return "stockout";
  if (quantity < safetyStock) return "below_safety";
  return "reorder_only";
}

/** リスト用スロット（ダッシュボード抜粋など） */
export function inventoryAlertListItemSurfaceClass(
  level: InventoryAlertLevel,
): string {
  switch (level) {
    case "stockout":
      return [
        "rounded-xl border border-red-200/60 bg-red-50/55 shadow-sm",
        "dark:border-red-900/45 dark:bg-red-950/28",
      ].join(" ");
    case "below_safety":
      return [
        "rounded-xl border border-amber-200/60 bg-amber-50/55 shadow-sm",
        "dark:border-amber-800/45 dark:bg-amber-950/22",
      ].join(" ");
    case "reorder_only":
      return [
        "rounded-xl border border-amber-200/45 bg-amber-50/38 shadow-sm",
        "dark:border-amber-800/32 dark:bg-amber-950/14",
      ].join(" ");
  }
}

/** インラインバッジ（在庫一覧テーブル） */
export function inventoryAlertBadgeClass(level: InventoryAlertLevel): string {
  const base =
    "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium";
  switch (level) {
    case "stockout":
      return [
        base,
        "border border-red-200/80 bg-red-50 text-red-900",
        "dark:border-red-800/55 dark:bg-red-950/45 dark:text-red-100",
      ].join(" ");
    case "below_safety":
      return [
        base,
        "border border-amber-200/80 bg-amber-50 text-amber-950",
        "dark:border-amber-800/55 dark:bg-amber-950/40 dark:text-amber-100",
      ].join(" ");
    case "reorder_only":
      return [
        base,
        "border border-amber-200/65 bg-amber-50/90 text-amber-950",
        "dark:border-amber-800/45 dark:bg-amber-950/30 dark:text-amber-100",
      ].join(" ");
  }
}

/** KPI カード（在庫アラート）用の面・枠 */
export function inventoryAlertDashboardCalloutClass(
  levels: {
    hasStockout: boolean;
    hasBelowSafety: boolean;
  },
  hasAlerts: boolean,
): string {
  if (!hasAlerts) {
    return "border border-[var(--border)] bg-[var(--surface)]";
  }
  if (levels.hasStockout) {
    return [
      "border border-red-200/65 bg-red-50/50 ring-1 ring-red-900/[0.06]",
      "dark:border-red-900/45 dark:bg-red-950/25 dark:ring-red-500/12",
    ].join(" ");
  }
  if (levels.hasBelowSafety) {
    return [
      "border border-amber-200/65 bg-amber-50/50 ring-1 ring-amber-900/[0.05]",
      "dark:border-amber-800/45 dark:bg-amber-950/22 dark:ring-amber-500/10",
    ].join(" ");
  }
  return [
    "border border-amber-200/50 bg-amber-50/40 ring-1 ring-amber-900/[0.04]",
    "dark:border-amber-800/35 dark:bg-amber-950/16 dark:ring-amber-500/8",
  ].join(" ");
}

/** ダッシュボード「在庫アラート」抜粋セクションの枠 */
export function inventoryAlertSectionShellClass(
  levels: { hasStockout: boolean; hasBelowSafety: boolean },
  hasItems: boolean,
): string {
  if (!hasItems) return "border border-[var(--border)]";
  if (levels.hasStockout) {
    return "border border-red-200/55 dark:border-red-900/40";
  }
  if (levels.hasBelowSafety) {
    return "border border-amber-200/55 dark:border-amber-800/40";
  }
  return "border border-amber-200/45 dark:border-amber-800/32";
}

/** SKU 詳細の帯 */
export function inventoryAlertBannerClass(level: InventoryAlertLevel): string {
  switch (level) {
    case "stockout":
      return [
        "border-b border-red-200/55 bg-red-50/55",
        "dark:border-red-900/40 dark:bg-red-950/25",
      ].join(" ");
    case "below_safety":
      return [
        "border-b border-amber-200/55 bg-amber-50/55",
        "dark:border-amber-800/40 dark:bg-amber-950/20",
      ].join(" ");
    case "reorder_only":
      return [
        "border-b border-amber-200/45 bg-amber-50/40",
        "dark:border-amber-800/32 dark:bg-amber-950/14",
      ].join(" ");
  }
}

export function recommendedOrderQty(quantity: number, safetyStock: number): number {
  return Math.max(0, safetyStock - quantity);
}
