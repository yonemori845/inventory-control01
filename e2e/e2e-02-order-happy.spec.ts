import { expect, test } from "@playwright/test";
import { e2eCredentialsConfigured, signInWithPassword } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("E2E-02", () => {
  test("在庫十分な SKU で注文確定し在庫が 1 減る", async ({ page }) => {
    test.skip(!e2eCredentialsConfigured(), "E2E_TEST_EMAIL / E2E_TEST_PASSWORD を設定してください");
    await signInWithPassword(page);

    await page.goto("/orders/new");
    await expect(page.getByRole("heading", { name: "注文作成" })).toBeVisible();

    const addSection = page.locator("section").filter({ hasText: "商品の追加" });
    const firstSkuBtn = addSection.locator("ul li button").first();
    const count = await firstSkuBtn.count();
    test.skip(count === 0, "アクティブ SKU が 0 件のためスキップ（マスタを投入してください）");

    const beforeText = await firstSkuBtn.textContent();
    const stockMatch = beforeText?.match(/在庫\s*(\d+)/);
    test.skip(!stockMatch, "在庫表記を解析できませんでした");
    const beforeStock = parseInt(stockMatch![1], 10);
    test.skip(beforeStock < 1, "先頭 SKU の在庫が 0 のためスキップ");

    const skuCode = (await firstSkuBtn.locator(".font-mono").first().textContent())?.trim();
    test.skip(!skuCode, "SKU コードを取得できませんでした");

    await firstSkuBtn.click();
    await page.getByRole("button", { name: "注文を確定" }).click();

    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/i, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "注文詳細" })).toBeVisible();

    await page.goto("/orders/new");
    await expect(page.getByRole("heading", { name: "注文作成" })).toBeVisible();

    const rowAfter = addSection
      .locator("ul li button")
      .filter({ hasText: skuCode })
      .first();
    await expect(rowAfter).toBeVisible();
    const afterText = await rowAfter.textContent();
    const afterMatch = afterText?.match(/在庫\s*(\d+)/);
    expect(afterMatch, "再読み込み後も在庫表記があること").toBeTruthy();
    const afterStock = parseInt(afterMatch![1], 10);
    expect(afterStock).toBe(beforeStock - 1);
  });
});
