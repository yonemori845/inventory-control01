import { LogoutButton } from "@/components/auth/LogoutButton";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-52 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
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
        <div className="mt-auto border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="truncate px-2 text-xs text-neutral-500" title={user?.email}>
            {user?.email ?? "—"}
          </p>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
