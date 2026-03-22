"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { from: string; to: string };

export function DashboardPeriodNav({ from, to }: Props) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`);
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">
          開始日
        </label>
        <input
          type="date"
          value={f}
          onChange={(e) => setF(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">
          終了日
        </label>
        <input
          type="date"
          value={t}
          onChange={(e) => setT(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
      </div>
      <button
        type="submit"
        className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
      >
        適用
      </button>
    </form>
  );
}
