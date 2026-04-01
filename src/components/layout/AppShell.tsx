"use client";

import { LogoMark } from "@/components/brand/LogoMark";
import { LogoutButton } from "@/components/auth/LogoutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { navGroups, navItemActive } from "./sidebar-data";

function AppBrandLink({
  className,
  compact,
}: {
  className?: string;
  /** モバイルトップバー用：1行・サブタイトル非表示 */
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      className={[
        "group flex min-w-0 max-w-[min(100%,18rem)] items-center gap-2.5 rounded-xl py-1 pl-0.5 pr-2 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 dark:focus-visible:ring-white/20",
        className ?? "",
      ].join(" ")}
    >
      <div
        className={[
          "flex shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] shadow-inner dark:border-[var(--border)] dark:bg-[var(--surface-muted)]",
          compact ? "h-9 w-9" : "h-10 w-10",
        ].join(" ")}
        aria-hidden
      >
        <LogoMark
          className={[
            "text-[var(--foreground)]",
            compact ? "h-5 w-5" : "h-6 w-6",
          ].join(" ")}
        />
      </div>
      <div className="min-w-0 text-left">
        <p
          className={[
            "truncate font-semibold tracking-tight text-[var(--foreground)]",
            compact ? "text-sm leading-tight" : "text-sm",
          ].join(" ")}
        >
          在庫コントロール
        </p>
        {!compact ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Inventory Control
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 sm:py-5">
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

/** 20×20 領域で線間隔を均等にし、開閉時は中央で X に変形 */
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-5 w-5 shrink-0" aria-hidden>
      <span
        className={[
          "absolute left-0 top-1 h-0.5 w-5 origin-center rounded-full bg-current transition duration-300 ease-out motion-reduce:duration-150",
          open ? "translate-y-[6px] rotate-45" : "translate-y-0 rotate-0",
        ].join(" ")}
      />
      <span
        className={[
          "absolute left-0 top-[10px] h-0.5 w-5 rounded-full bg-current transition duration-200 ease-out motion-reduce:duration-150",
          open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100",
        ].join(" ")}
      />
      <span
        className={[
          "absolute left-0 top-[16px] h-0.5 w-5 origin-center rounded-full bg-current transition duration-300 ease-out motion-reduce:duration-150",
          open ? "-translate-y-[6px] -rotate-45" : "translate-y-0 rotate-0",
        ].join(" ")}
      />
    </span>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
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

      <header className="fixed inset-x-0 top-0 z-40 flex h-[3.25rem] items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--sidebar-bg)]/90 px-3 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-xl dark:bg-[var(--sidebar-bg-dark)]/90 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)] sm:px-4 lg:hidden">
        <AppBrandLink compact className="min-w-0 max-w-[calc(100%-3.25rem)]" />
        <button
          type="button"
          id={`${drawerId}-trigger`}
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          aria-haspopup="dialog"
          aria-label={menuOpen ? "ナビゲーションを閉じる" : "ナビゲーションを開く"}
          onClick={() => setMenuOpen((o) => !o)}
          className="btn-icon h-10 w-10 shrink-0 sm:h-11 sm:w-11"
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </header>

      <div className="lg:hidden" aria-hidden={!menuOpen}>
        {menuOpen ? (
          <button
            type="button"
            aria-label="オーバーレイをタップして閉じる"
            className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-sm transition-opacity dark:bg-black/55"
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
            "fixed inset-y-0 left-0 z-[60] flex h-dvh max-h-dvh w-[min(300px,90vw)] max-w-full flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-[4px_0_24px_-4px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:bg-[var(--sidebar-bg-dark)] dark:shadow-[4px_0_32px_-4px_rgba(0,0,0,0.5)]",
            menuOpen
              ? "translate-x-0"
              : "-translate-x-full pointer-events-none",
          ].join(" ")}
        >
          <div className="flex h-[3.25rem] shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-4 dark:bg-[var(--sidebar-bg-dark)]">
            <div className="min-w-0">
              <p
                id={`${drawerId}-title`}
                className="truncate text-sm font-semibold leading-tight text-[var(--foreground)]"
              >
                在庫コントロール
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                ナビゲーション
              </p>
            </div>
            <button
              type="button"
              aria-label="ナビゲーションを閉じる"
              onClick={() => setMenuOpen(false)}
              className="btn-icon h-10 w-10 shrink-0 text-neutral-500 hover:text-[var(--foreground)]"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
          <SidebarNavigation onNavigate={() => setMenuOpen(false)} />
          <SidebarUserBlock userEmail={userEmail} />
        </aside>
      </div>

      <div className="min-w-0 pt-[3.25rem] lg:ml-[260px] lg:pt-0">{children}</div>
    </div>
  );
}
