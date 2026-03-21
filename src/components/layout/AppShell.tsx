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
        "flex min-w-0 max-w-[min(100%,18rem)] items-center gap-2.5 rounded-xl py-1 pl-0.5 pr-2 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar-bg)] dark:focus-visible:ring-offset-[var(--sidebar-bg-dark)]",
        className ?? "",
      ].join(" ")}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold tracking-tight text-white shadow-sm dark:bg-white dark:text-slate-900"
        aria-hidden
      >
        IC
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
          在庫コントロール
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          Operations
        </p>
      </div>
    </Link>
  );
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
      {navGroups.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
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
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                      active
                        ? "bg-indigo-50/95 text-indigo-950 shadow-sm ring-1 ring-indigo-200/60 dark:bg-indigo-500/[0.12] dark:text-indigo-50 dark:ring-indigo-400/20"
                        : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-7 w-1 shrink-0 rounded-full transition-colors duration-200",
                        active
                          ? "bg-indigo-500 shadow-[0_0_12px_-2px_rgba(99,102,241,0.65)] dark:bg-sky-400 dark:shadow-[0_0_12px_-2px_rgba(56,189,248,0.5)]"
                          : "bg-transparent",
                      ].join(" ")}
                      aria-hidden
                    />
                    <span className={active ? "font-semibold" : ""}>
                      {item.label}
                    </span>
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
    <div className="border-t border-slate-200/80 p-4 dark:border-slate-800/80">
      <div className="rounded-xl border border-slate-200/90 bg-white/80 p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/50">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          ログイン中
        </p>
        <p
          className="mt-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100"
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
    <div className="flex min-h-screen bg-[var(--app-canvas)] dark:bg-[var(--app-canvas-dark)]">
      {/* Desktop sidebar */}
      <aside className="app-sidebar hidden w-[260px] shrink-0 flex-col border-r border-slate-200/90 bg-[var(--sidebar-bg)] dark:border-slate-800/90 dark:bg-[var(--sidebar-bg-dark)] lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200/80 px-5 dark:border-slate-800/80">
          <AppBrandLink />
        </div>
        <SidebarNavigation />
        <SidebarUserBlock userEmail={userEmail} />
      </aside>

      {/* Tablet / phone: top bar — brand left, menu right */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-slate-200/90 bg-[var(--sidebar-bg)]/92 px-4 backdrop-blur-md dark:border-slate-800/90 dark:bg-[var(--sidebar-bg-dark)]/92 lg:hidden">
        <AppBrandLink className="max-w-[calc(100%-3.5rem)]" />
        <button
          type="button"
          id={`${drawerId}-trigger`}
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white/90 text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-slate-700/90 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </header>

      {/* Drawer */}
      <div className="lg:hidden" aria-hidden={!menuOpen}>
        {menuOpen ? (
          <button
            type="button"
            aria-label="メニューを閉じる"
            className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] transition-opacity dark:bg-black/50"
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
            "fixed left-0 top-0 z-[60] flex h-full min-h-0 w-[min(280px,88vw)] max-w-full flex-col border-r border-slate-200/90 bg-[var(--sidebar-bg)] shadow-2xl shadow-slate-900/10 transition-transform duration-300 ease-out motion-reduce:transition-none dark:border-slate-800/90 dark:bg-[var(--sidebar-bg-dark)] dark:shadow-black/40",
            menuOpen
              ? "translate-x-0"
              : "-translate-x-full pointer-events-none",
          ].join(" ")}
        >
          <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-200/80 px-4 dark:border-slate-800/80">
            <p
              id={`${drawerId}-title`}
              className="text-sm font-semibold text-slate-900 dark:text-white"
            >
              メニュー
            </p>
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => setMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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

      <div className="min-w-0 flex-1 pt-14 lg:pt-0">{children}</div>
    </div>
  );
}
