/** 機能設計 §4.7: quantity <= reorder_point または quantity < safety_stock */

export function isInventoryAlert(
  quantity: number,
  reorderPoint: number,
  safetyStock: number,
): boolean {
  return quantity <= reorderPoint || quantity < safetyStock;
}

export function recommendedOrderQty(quantity: number, safetyStock: number): number {
  return Math.max(0, safetyStock - quantity);
}
