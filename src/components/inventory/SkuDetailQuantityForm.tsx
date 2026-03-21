"use client";

import { adjustSkuQuantityAction } from "@/app/actions/inventory";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function SkuDetailQuantityForm({
  skuId,
  initialQuantity,
}: {
  skuId: string;
  initialQuantity: number;
}) {
  const router = useRouter();
  const [val, setVal] = useState(String(initialQuantity));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setVal(String(initialQuantity));
  }, [initialQuantity]);

  function save() {
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n < 0) return;
    startTransition(() => {
      void adjustSkuQuantityAction(skuId, n).then((r) => {
        if (r.ok) router.refresh();
      });
    });
  }

  return (
    <div className="flex flex-wrap items-stretch gap-2 sm:items-center">
      <input
        type="number"
        min={0}
        disabled={pending}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm tabular-nums text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-slate-500"
      />
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        保存
      </button>
    </div>
  );
}
