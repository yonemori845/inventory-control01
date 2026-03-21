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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200/80 bg-white/90 p-4 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/90">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
          メニュー
        </p>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-200/80 pt-4 dark:border-slate-800/80">
          <p
            className="truncate px-3 text-xs text-slate-500 dark:text-slate-400"
            title={user?.email}
          >
            {user?.email ?? "—"}
          </p>
          <div className="mt-2 px-1">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
