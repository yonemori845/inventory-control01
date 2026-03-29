import type { ReactNode } from "react";

/**
 * ダッシュボードと同一のメインカラム（左右余白・max-width）。
 * 縦方向は Pro UI 向けにコンパクトなリズム（約 20–24px 上、32–40px 下）。
 * 注: `(app)/layout` のラッパーは余白を持たせない（二重パディング防止）。
 */
export const APP_PAGE_CONTAINER_CLASS =
  "mx-auto w-full max-w-7xl px-4 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-6 lg:px-10 lg:pb-10 lg:pt-6";

export function AppPageMain({
  children,
  className,
}: {
  children: ReactNode;
  /** 例: pb-24 */
  className?: string;
}) {
  return (
    <main
      className={["relative min-h-screen", className].filter(Boolean).join(" ")}
    >
      <div className={APP_PAGE_CONTAINER_CLASS}>{children}</div>
    </main>
  );
}
