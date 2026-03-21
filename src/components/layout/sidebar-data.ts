export type NavItem = { href: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    title: "概要",
    items: [{ href: "/", label: "ダッシュボード" }],
  },
  {
    title: "在庫",
    items: [
      { href: "/inventory", label: "在庫一覧" },
      { href: "/inventory/movements", label: "入出庫履歴" },
    ],
  },
  {
    title: "注文",
    items: [
      { href: "/orders", label: "注文一覧" },
      { href: "/orders/new", label: "注文作成" },
    ],
  },
  {
    title: "その他",
    items: [
      { href: "/reports", label: "レポート" },
      { href: "/settings", label: "設定" },
      { href: "/admin/users", label: "ユーザー管理" },
    ],
  },
];

export function navItemActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  if (href === "/inventory") {
    return (
      pathname === "/inventory" || pathname.startsWith("/inventory/sku/")
    );
  }
  if (href === "/inventory/movements") {
    return pathname.startsWith("/inventory/movements");
  }
  if (href === "/orders/new") {
    return pathname.startsWith("/orders/new");
  }
  if (href === "/orders") {
    if (pathname.startsWith("/orders/new")) return false;
    return pathname === "/orders" || pathname.startsWith("/orders/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
