"use client";

import {
  addCalendarDaysTokyo,
  firstDayOfMonthIsoInTokyo,
  todayIsoInTokyo,
} from "@/lib/tokyo-date";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Preset = "month" | "d30" | "d7" | "custom";

type Props = { from: string; to: string };

function presetsForToday(today: string) {
  return {
    month: { from: firstDayOfMonthIsoInTokyo(), to: today },
    d30: { from: addCalendarDaysTokyo(today, -29), to: today },
    d7: { from: addCalendarDaysTokyo(today, -6), to: today },
  } as const;
}

function activePreset(
  from: string,
  to: string,
  today: string,
): Preset {
  const p = presetsForToday(today);
  const match = (a: { from: string; to: string }) =>
    a.from === from && a.to === to;
  if (match(p.month)) return "month";
  if (match(p.d30)) return "d30";
  if (match(p.d7)) return "d7";
  return "custom";
}

export function DashboardPeriodNav({ from, to }: Props) {
  const router = useRouter();
  const today = useMemo(() => todayIsoInTokyo(), []);
  const preset = activePreset(from, to, today);
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const p = presetsForToday(today);

  useEffect(() => {
    setF(from);
    setT(to);
  }, [from, to]);

  function pushRange(nextFrom: string, nextTo: string) {
    router.push(`/?from=${encodeURIComponent(nextFrom)}&to=${encodeURIComponent(nextTo)}`);
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    pushRange(f, t);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <div
        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-1"
        role="group"
        aria-label="期間プリセット"
      >
        {(
          [
            { key: "month" as const, label: "今月" },
            { key: "d30" as const, label: "過去30日" },
            { key: "d7" as const, label: "過去7日" },
          ] as const
        ).map(({ key, label }) => {
          const on = preset === key;
          const r = p[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => pushRange(r.from, r.to)}
              className={[
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                on
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border-strong)]"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={apply}
        className="flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-4 sm:flex-nowrap sm:border-0 sm:pt-0"
      >
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            開始
          </label>
          <input
            type="date"
            value={f}
            onChange={(e) => setF(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)] shadow-sm dark:bg-[var(--surface-muted)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            終了
          </label>
          <input
            type="date"
            value={t}
            onChange={(e) => setT(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)] shadow-sm dark:bg-[var(--surface-muted)]"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-lg border border-neutral-900 bg-neutral-900 px-4 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          適用
        </button>
        {preset === "custom" ? (
          <span className="hidden text-[10px] font-medium text-neutral-400 sm:inline">
            カスタム期間
          </span>
        ) : null}
      </form>
    </div>
  );
}
