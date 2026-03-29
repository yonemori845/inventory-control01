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
        className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-sm tabular-nums text-[var(--foreground)] shadow-sm transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:bg-[var(--surface-muted)] dark:focus:ring-white/10"
      />
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface-muted)] disabled:opacity-40"
      >
        保存
      </button>
    </div>
  );
}
