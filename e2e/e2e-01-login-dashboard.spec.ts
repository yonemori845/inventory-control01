import { expect, test } from "@playwright/test";
import { e2eCredentialsConfigured, signInWithPassword } from "./helpers";

test.describe("E2E-01", () => {
  test("メール／パスワードでログインしダッシュボードを表示する", async ({
    page,
  }) => {
    test.skip(!e2eCredentialsConfigured(), "E2E_TEST_EMAIL / E2E_TEST_PASSWORD を設定してください");
    await signInWithPassword(page);
    await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
