"use client";

import { LogoutButton } from "@/components/auth/LogoutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { navGroups, navItemActive } from "./sidebar-data";

function AppBrandLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={[
        "group flex min-w-0 max-w-[min(100%,18rem)] items-center gap-3 rounded-xl py-1 pl-0.5 pr-2 outline-none transition-opacity hover:opacity-90",
        className ?? "",
      ].join(" ")}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-semibold tracking-tight text-[var(--foreground)] shadow-sm"
        aria-hidden
      >
        IC
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">
          在庫コントロール
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
          Operations
        </p>
      </div>
    </Link>
  );
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-5">
      {navGroups.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = navItemActive(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    className={[
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150",
                      active
                        ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border-strong)]"
                        : "text-neutral-600 hover:bg-black/[0.04] hover:text-[var(--foreground)] dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-neutral-100",
                    ].join(" ")}
                  >
                    <span className={active ? "font-semibold" : ""}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarUserBlock({ userEmail }: { userEmail: string | null }) {
  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--sidebar-bg)] p-4 dark:bg-[var(--sidebar-bg-dark)]">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
          ログイン中
        </p>
        <p
          className="mt-1 truncate text-xs font-medium text-[var(--foreground)]"
          title={userEmail ?? undefined}
        >
          {userEmail ?? "—"}
        </p>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-5 w-5" aria-hidden>
      <span
        className={[
          "absolute left-0 top-1 h-0.5 w-5 rounded-full bg-current transition-transform duration-200",
          open ? "translate-y-2 rotate-45" : "",
        ].join(" ")}
      />
      <span
        className={[
          "absolute left-0 top-[9px] h-0.5 w-5 rounded-full bg-current transition-opacity duration-200",
          open ? "opacity-0" : "opacity-100",
        ].join(" ")}
      />
      <span
        className={[
          "absolute left-0 top-[17px] h-0.5 w-5 rounded-full bg-current transition-transform duration-200",
          open ? "-translate-y-2 -rotate-45" : "",
        ].join(" ")}
      />
    </span>
  );
}

export function AppShell({
  userEmail,
  children,
}: {
  userEmail: string | null;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const drawerId = useId();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] dark:bg-[var(--app-canvas-dark)]">
      <aside
        className="app-sidebar fixed inset-y-0 left-0 z-30 hidden h-dvh max-h-dvh w-[260px] min-h-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] dark:bg-[var(--sidebar-bg-dark)] lg:flex"
        aria-label="メインナビゲーション"
      >
        <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-5">
          <AppBrandLink />
        </div>
        <SidebarNavigation />
        <SidebarUserBlock userEmail={userEmail} />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--sidebar-bg)]/95 px-4 backdrop-blur-md dark:bg-[var(--sidebar-bg-dark)]/95 lg:hidden">
        <AppBrandLink className="max-w-[calc(100%-3.5rem)]" />
        <button
          type="button"
          id={`${drawerId}-trigger`}
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
          onClick={() => setMenuOpen((o) => !o)}
          className="btn-icon"
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </header>

      <div className="lg:hidden" aria-hidden={!menuOpen}>
        {menuOpen ? (
          <button
            type="button"
            aria-label="メニューを閉じる"
            className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}
        <aside
          id={drawerId}
          role="dialog"
          aria-modal={menuOpen}
          aria-hidden={!menuOpen}
          aria-labelledby={`${drawerId}-title`}
          className={[
            "fixed inset-y-0 left-0 z-[60] flex h-dvh max-h-dvh w-[min(280px,88vw)] max-w-full flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-[var(--sidebar-bg-dark)]",
            menuOpen
              ? "translate-x-0"
              : "-translate-x-full pointer-events-none",
          ].join(" ")}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4">
            <p
              id={`${drawerId}-title`}
              className="text-sm font-semibold text-[var(--foreground)]"
            >
              メニュー
            </p>
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => setMenuOpen(false)}
              className="btn-icon text-neutral-500 hover:text-[var(--foreground)]"
            >
              <span className="text-xl leading-none" aria-hidden>
                ×
              </span>
            </button>
          </div>
          <SidebarNavigation onNavigate={() => setMenuOpen(false)} />
          <SidebarUserBlock userEmail={userEmail} />
        </aside>
      </div>

      <div className="min-w-0 pt-14 lg:ml-[260px] lg:pt-0">{children}</div>
    </div>
  );
}
