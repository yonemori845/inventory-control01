import type { Page } from "@playwright/test";

export function e2eCredentialsConfigured(): boolean {
  return !!(
    process.env.E2E_TEST_EMAIL?.trim() && process.env.E2E_TEST_PASSWORD
  );
}

/** メール／パスワードでサインイン（機能設計 E2E-01） */
export async function signInWithPassword(page: Page): Promise<void> {
  const email = process.env.E2E_TEST_EMAIL!.trim();
  const password = process.env.E2E_TEST_PASSWORD!;
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  // LoginForm に「サインイン」モード切替（type=button）と送信（type=submit）の2つがあるため form で限定する
  await page.locator("form").getByRole("button", { name: "サインイン" }).click();
  await page.getByRole("heading", { name: "ダッシュボード" }).waitFor({
    timeout: 30_000,
  });
}
