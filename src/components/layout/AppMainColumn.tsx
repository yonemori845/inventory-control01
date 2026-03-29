import type { ReactNode } from "react";

/**
 * 認証後レイアウト用の幅ラッパー。縦パディングは {@link AppPageMain} 内のコンテナのみが担う。
 */
export function AppMainColumn({ children }: { children: ReactNode }) {
  return <div className="min-w-0 w-full">{children}</div>;
}
