"use client";

import {
  adjustSkuQuantityAction,
  barcodeInboundAction,
  importProductCsvRowsAction,
} from "@/app/actions/inventory";
import { parseInventoryCsv, rowsToJsonForRpc } from "@/lib/inventory/csv";
import {
  isInventoryAlert,
  recommendedOrderQty,
} from "@/lib/inventory/alerts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type SkuRow = {
  id: string;
  sku_code: string;
  jan_code: string;
  name_variant: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  reorder_point: number;
  safety_stock: number;
  unit_price_ex_tax: string | number;
  is_active: boolean;
};

export type GroupRow = {
  id: string;
  group_code: string;
  name: string;
  sort_order: number;
  product_skus: SkuRow[] | null;
};

type Summary = {
  groupCount: number;
  skuCount: number;
  totalQty: number;
  alertCount: number;
};

type Props = {
  groups: GroupRow[];
  summary: Summary;
};

export function InventoryListClient({ groups, summary }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((g) => {
        const skus = (g.product_skus ?? []).filter((s) => {
          const hay = [
            g.name,
            g.group_code,
            s.sku_code,
            s.jan_code,
            s.name_variant ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(needle);
        });
        const groupHit =
          g.name.toLowerCase().includes(needle) ||
          g.group_code.toLowerCase().includes(needle);
        if (groupHit) return { ...g, product_skus: g.product_skus ?? [] };
        if (skus.length) return { ...g, product_skus: skus };
        return null;
      })
      .filter(Boolean) as GroupRow[];
  }, [groups, q]);

  function runMsg(p: Promise<{ ok: boolean; message?: string }>) {
    startTransition(() => {
      void p.then((r) => {
        if (r.ok) {
          setMessage("保存しました。");
          router.refresh();
        } else {
          setMessage(r.message ?? "エラー");
        }
      });
    });
  }

  async function onCsvFile(f: File) {
    setMessage(null);
    const text = await f.text();
    const parsed = parseInventoryCsv(text);
    if (!parsed.ok) {
      setMessage(
        parsed.errors.map((e) => `行${e.line}: ${e.message}`).join("\n"),
      );
      return;
    }
    const json = rowsToJsonForRpc(parsed.rows);
    startTransition(() => {
      void importProductCsvRowsAction(json).then((r) => {
        if (r.ok) {
          setMessage("CSV を取り込みました。");
          router.refresh();
        } else {
          setMessage(r.message);
        }
      });
    });
  }

  return (
    <main className="p-6">
      <p className="text-xs font-mono text-neutral-500">SCR-INV-LIST</p>
      <h1 className="mt-1 text-xl font-semibold">在庫一覧</h1>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="商品グループ" value={summary.groupCount} />
        <SummaryCard label="SKU 数" value={summary.skuCount} />
        <SummaryCard label="総在庫数" value={summary.totalQty} />
        <SummaryCard
          label="在庫アラート SKU"
          value={summary.alertCount}
          warn={summary.alertCount > 0}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="名前・グループコード・SKU・JAN で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        />
        <a
          href="/api/inventory/csv-template"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
        >
          CSV テンプレ DL
        </a>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
        >
          CSV アップロード
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onCsvFile(f);
          }}
        />
        <Link
          href="/inventory/movements"
          className="text-sm text-neutral-600 underline dark:text-neutral-400"
        >
          入出庫履歴
        </Link>
      </div>

      {message ? (
        <pre className="mt-4 whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
          {message}
        </pre>
      ) : null}

      <BarcodeInboundPanel
        disabled={pending}
        onResult={(msg) => setMessage(msg)}
        onSuccess={() => router.refresh()}
      />

      <div className="mt-8 space-y-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-neutral-500">
            該当する商品がありません。CSV テンプレをダウンロードしてデータを投入してください。
          </p>
        ) : (
          filtered.map((g) => (
            <GroupBlock
              key={g.id}
              group={g}
              disabled={pending}
              onAdjust={(skuId, qty) =>
                runMsg(adjustSkuQuantityAction(skuId, qty))
              }
            />
          ))
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        warn
          ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
      }`}
    >
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function GroupBlock({
  group,
  disabled,
  onAdjust,
}: {
  group: GroupRow;
  disabled: boolean;
  onAdjust: (skuId: string, qty: number) => void;
}) {
  const skus = group.product_skus ?? [];
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900"
      >
        <span className="font-medium">
          {group.name}{" "}
          <span className="text-sm font-normal text-neutral-500">
            ({group.group_code}) · SKU {skus.length}
          </span>
        </span>
        <span className="text-neutral-400">{open ? "▼" : "▶"}</span>
      </button>
      {open ? (
        <div className="overflow-x-auto border-t border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">JAN</th>
                <th className="px-3 py-2">バリエーション</th>
                <th className="px-3 py-2 text-right">在庫</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((s) => (
                <SkuEditRow
                  key={s.id}
                  sku={s}
                  disabled={disabled}
                  onSave={(qty) => onAdjust(s.id, qty)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function SkuEditRow({
  sku,
  disabled,
  onSave,
}: {
  sku: SkuRow;
  disabled: boolean;
  onSave: (qty: number) => void;
}) {
  const [val, setVal] = useState(String(sku.quantity));
  useEffect(() => {
    setVal(String(sku.quantity));
  }, [sku.id, sku.quantity]);
  const alert = isInventoryAlert(
    sku.quantity,
    sku.reorder_point,
    sku.safety_stock,
  );
  const rec = recommendedOrderQty(sku.quantity, sku.safety_stock);

  return (
    <tr className="border-t border-neutral-100 dark:border-neutral-800">
      <td className="px-3 py-2 font-mono text-xs">{sku.sku_code}</td>
      <td className="px-3 py-2 font-mono text-xs">{sku.jan_code}</td>
      <td className="px-3 py-2">
        {[sku.name_variant, sku.color, sku.size].filter(Boolean).join(" / ") ||
          "—"}
        {alert ? (
          <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            アラート
            {rec > 0 ? ` · 推奨発注 ${rec}` : ""}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{sku.quantity}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <input
            type="number"
            min={0}
            className="w-20 rounded border border-neutral-300 px-2 py-1 text-right dark:border-neutral-600 dark:bg-neutral-900"
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const n = parseInt(val, 10);
              if (Number.isNaN(n) || n < 0) return;
              onSave(n);
            }}
            className="rounded bg-neutral-800 px-2 py-1 text-xs text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-900"
          >
            保存
          </button>
        </div>
      </td>
    </tr>
  );
}

function BarcodeInboundPanel({
  disabled,
  onResult,
  onSuccess,
}: {
  disabled: boolean;
  onResult: (s: string | null) => void;
  onSuccess: () => void;
}) {
  const [jan, setJan] = useState("");
  const [qty, setQty] = useState("1");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  async function stopCamera() {
    activeRef.current = false;
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }

  async function startScan() {
    onResult(null);
    if (!("BarcodeDetector" in window)) {
      onResult("このブラウザは BarcodeDetector 非対応です。JAN を手入力してください。");
      return;
    }
    await stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      setScanning(true);
      activeRef.current = true;
      const BD = (window as unknown as BarcodeDetectorWindow).BarcodeDetector;
      const detector = new BD({
        formats: ["ean_13", "ean_8", "code_128", "itf", "upc_a", "upc_e"],
      });
      scanIntervalRef.current = setInterval(() => {
        void (async () => {
          if (!activeRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              setJan(codes[0].rawValue);
              onResult("JAN を読み取りました。数量を確認して入庫してください。");
              await stopCamera();
            }
          } catch {
            /* フレームごとの検出失敗は無視 */
          }
        })();
      }, 300);
    } catch {
      onResult("カメラを起動できませんでした。権限または HTTPS/localhost を確認してください。");
    }
  }

  function submitInbound() {
    onResult(null);
    const q = parseInt(qty, 10);
    if (!jan.trim() || Number.isNaN(q) || q <= 0) {
      onResult("JAN と数量（1以上）を入力してください。");
      return;
    }
    void barcodeInboundAction(jan.trim(), q).then((r) => {
      if (r.ok) {
        onResult("入庫しました。");
        setJan("");
        setQty("1");
        onSuccess();
      } else {
        onResult(r.message);
      }
    });
  }

  return (
    <section className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-sm font-semibold">バーコード入庫（JAN）</h2>
      <p className="mt-1 text-xs text-neutral-500">
        カメラで読み取るか、JAN を直接入力します（reason: barcode_inbound）。
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-neutral-500">JAN</label>
          <input
            value={jan}
            onChange={(e) => setJan(e.target.value)}
            className="w-48 rounded border border-neutral-300 px-2 py-1 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-900"
            placeholder="4901234567890"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">数量</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => submitInbound()}
          className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          入庫する
        </button>
        <button
          type="button"
          disabled={disabled || scanning}
          onClick={() => void startScan()}
          className="rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
        >
          カメラでスキャン
        </button>
        {scanning ? (
          <button
            type="button"
            onClick={() => void stopCamera()}
            className="text-sm text-red-600 underline"
          >
            スキャン停止
          </button>
        ) : null}
      </div>
      <video
        ref={videoRef}
        className="mt-3 max-h-48 rounded border border-neutral-200 dark:border-neutral-700"
        muted
        playsInline
      />
    </section>
  );
}

type BarcodeDetectorWindow = {
  BarcodeDetector: new (opts: { formats: string[] }) => {
    detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
  };
};
