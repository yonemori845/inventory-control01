"use client";

import {
  addCalendarDaysTokyo,
  firstDayOfMonthIsoInTokyo,
  todayIsoInTokyo,
} from "@/lib/tokyo-date";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

type Preset = "month" | "d30" | "d7" | "custom";

type Props = { from: string; to: string };

function presetsForToday(today: string) {
  return {
    month: { from: firstDayOfMonthIsoInTokyo(), to: today },
    d30: { from: addCalendarDaysTokyo(today, -29), to: today },
    d7: { from: addCalendarDaysTokyo(today, -6), to: today },
  } as const;
}

function activePreset(from: string, to: string, today: string): Preset {
  const p = presetsForToday(today);
  const match = (a: { from: string; to: string }) =>
    a.from === from && a.to === to;
  if (match(p.month)) return "month";
  if (match(p.d30)) return "d30";
  if (match(p.d7)) return "d7";
  return "custom";
}

/** 今月 / 過去30日 / 過去7日 のピル切り替え（カードなし） */
export function DashboardPeriodPresets({ from, to }: Props) {
  const router = useRouter();
  const today = useMemo(() => todayIsoInTokyo(), []);
  const preset = activePreset(from, to, today);
  const p = presetsForToday(today);

  function pushRange(nextFrom: string, nextTo: string) {
    router.push(
      `/?from=${encodeURIComponent(nextFrom)}&to=${encodeURIComponent(nextTo)}`,
    );
  }

  return (
    <div
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm"
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
              "btn btn-sm !h-auto !min-h-0 !rounded-full px-3.5 py-1.5 font-semibold transition-colors",
              on
                ? "bg-[var(--surface-muted)] text-[var(--foreground)] ring-1 ring-[var(--border-strong)]"
                : "border-transparent bg-transparent text-neutral-600 shadow-none hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
