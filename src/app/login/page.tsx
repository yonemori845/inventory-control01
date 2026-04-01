import { LoginForm } from "@/components/auth/LoginForm";

type SearchParams = Promise<{
  next?: string;
  error?: string;
}>;

/** SCR-AUTH-LOGIN（デザイン設計書 §6.1） */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const nextPath =
    sp.next && sp.next.startsWith("/") ? sp.next : "/";

  return (
    <main className="login-page relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-12">
      {/* 背景: ソフトな放射グラデーション + ノイズ */}
      <div
        className="pointer-events-none absolute inset-0 bg-[var(--app-canvas)] dark:bg-[var(--app-canvas-dark)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(99,102,241,0.11),transparent_55%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(99,102,241,0.14),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_100%,rgba(16,185,129,0.06),transparent_50%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_100%_100%,rgba(16,185,129,0.08),transparent_50%)]"
        aria-hidden
      />
      {/* 微細ドット（プロダクト系ログインの質感） */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_center,rgba(0,0,0,0.045)_1px,transparent_1px)] [background-size:20px_20px] dark:opacity-[0.2] dark:[background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.06)_1px,transparent_1px)]"
        aria-hidden
      />

      <div className="relative z-[1] w-full max-w-[420px]">
        <LoginForm nextPath={nextPath} authError={sp.error} />
      </div>

      <p className="relative z-[1] mt-10 max-w-sm text-center text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-500">
        在庫・注文・レポートの一元管理
      </p>
    </main>
  );
}
