import Link from "next/link";

const navItems: { href: string; label: string }[] = [
  { href: "/", label: "ダッシュボード" },
  { href: "/inventory", label: "在庫" },
  { href: "/inventory/movements", label: "入出庫履歴" },
  { href: "/orders", label: "注文一覧" },
  { href: "/orders/new", label: "注文作成" },
  { href: "/reports", label: "レポート" },
  { href: "/settings", label: "設定" },
  { href: "/admin/users", label: "ユーザー管理" },
];

/**
 * 認証済みレイアウト（フェーズ B でガード）
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          メニュー
        </p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-2 py-1.5 text-sm text-neutral-800 hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Link
            href="/login"
            className="text-xs text-neutral-500 hover:underline dark:text-neutral-400"
          >
            ログイン（プレースホルダ）
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
