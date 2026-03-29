"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Item = { id: string; label: string; badge?: number };

export function DashboardAnchorNav({ items }: { items: Item[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }, []);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
        if (vis?.target?.id) setActive(vis.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [items]);

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const on = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                on
                  ? "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                  : "border-transparent bg-[var(--surface-muted)] text-neutral-600 hover:border-[var(--border)] hover:bg-[var(--surface)] dark:text-neutral-400",
              ].join(" ")}
            >
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 ? (
                <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white dark:bg-white dark:text-neutral-900">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <LinkHint href="/orders/new" label="新規注文" />
        <LinkHint href="/inventory" label="在庫一覧" secondary />
      </div>
    </div>
  );
}

function LinkHint({
  href,
  label,
  secondary,
}: {
  href: string;
  label: string;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        secondary
          ? "border-[var(--border)] bg-[var(--surface)] text-neutral-700 hover:border-[var(--border-strong)] dark:text-neutral-200"
          : "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200",
      ].join(" ")}
    >
      {secondary ? <span>{label}</span> : <span className="flex items-center gap-1">+ {label}</span>}
    </Link>
  );
}
