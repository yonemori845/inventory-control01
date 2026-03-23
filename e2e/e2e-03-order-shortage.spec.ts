import { expect, test } from "@playwright/test";
import { e2eCredentialsConfigured, signInWithPassword } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("E2E-03", () => {
  test("在庫不足で確定失敗し在庫が変わらない", async ({ page }) => {
    test.skip(!e2eCredentialsConfigured(), "E2E_TEST_EMAIL / E2E_TEST_PASSWORD を設定してください");
    await signInWithPassword(page);

    await page.goto("/orders/new");
    const addSection = page.locator("section").filter({ hasText: "商品の追加" });
    const firstSkuBtn = addSection.locator("ul li button").first();
    const count = await firstSkuBtn.count();
    test.skip(count === 0, "アクティブ SKU が 0 件のためスキップ");

    const beforeText = await firstSkuBtn.textContent();
    const stockMatch = beforeText?.match(/在庫\s*(\d+)/);
    test.skip(!stockMatch, "在庫表記を解析できませんでした");
    const beforeStock = parseInt(stockMatch![1], 10);

    const skuCode = (await firstSkuBtn.locator(".font-mono").first().textContent())?.trim();
    test.skip(!skuCode, "SKU コードを取得できませんでした");

    await firstSkuBtn.click();

    // 親 section には「…明細に追加…」の文言があるため hasText:明細 だと商品一覧の li まで含んでしまう
    const detailCard = page
      .locator("div.rounded-2xl")
      .filter({ has: page.getByRole("heading", { name: "明細", exact: true }) });
    const line = detailCard.locator("ul li").filter({ hasText: skuCode });
    await expect(line).toBeVisible();
    const plusBtn = line.locator("button").nth(1);
    const clicks = beforeStock + 5;
    for (let i = 0; i < clicks; i++) {
      await plusBtn.click();
    }

    await page.getByRole("button", { name: "注文を確定" }).click();

    await expect(
      page.getByText(/必要\s+\d+\s*\/\s*在庫\s+\d+/),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto("/orders/new");
    const rowAfter = addSection
      .locator("ul li button")
      .filter({ hasText: skuCode })
      .first();
    const afterText = await rowAfter.textContent();
    const afterMatch = afterText?.match(/在庫\s*(\d+)/);
    expect(afterMatch).toBeTruthy();
    expect(parseInt(afterMatch![1], 10)).toBe(beforeStock);
  });
});
