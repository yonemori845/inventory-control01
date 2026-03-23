/**
 * 開発用シード行（`import_product_csv_rows` 向け）。既存 SKU と衝突しないコードを使用。
 * 実行は `ALLOW_DEV_SEED=true` かつサーバーアクション経由のみ。
 */
export const DEV_SEED_ROWS: Record<string, unknown>[] = [
  {
    group_code: "SEED-G1",
    group_name: "開発シード グループA",
    group_description: "フェーズ E 開発用（本番では無効）",
    sort_order: 9901,
    sku_code: "SEED-SKU-001",
    jan_code: "4509900000001",
    name_variant: "デモSKU 1",
    quantity: 12,
    reorder_point: 3,
    safety_stock: 2,
    unit_price_ex_tax: "500",
    is_active: "true",
  },
  {
    group_code: "SEED-G1",
    group_name: "開発シード グループA",
    sort_order: 9901,
    sku_code: "SEED-SKU-002",
    jan_code: "4509900000002",
    name_variant: "デモSKU 2",
    quantity: 8,
    reorder_point: 2,
    safety_stock: 1,
    unit_price_ex_tax: "1200",
    is_active: "true",
  },
  {
    group_code: "SEED-G2",
    group_name: "開発シード グループB",
    sort_order: 9902,
    sku_code: "SEED-SKU-003",
    jan_code: "4509900000003",
    name_variant: "デモSKU 3",
    quantity: 20,
    reorder_point: 5,
    safety_stock: 3,
    unit_price_ex_tax: "350.5",
    is_active: "true",
  },
];
