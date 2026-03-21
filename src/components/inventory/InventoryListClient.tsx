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
import type { ReactNode } from "react";
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
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">(
    "info",
  );
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
          setMessageTone("success");
          setMessage("変更を保存しました。");
          router.refresh();
        } else {
          setMessageTone("error");
          setMessage(r.message ?? "エラーが発生しました。");
        }
      });
    });
  }

  async function onCsvFile(f: File) {
    setMessage(null);
    const text = await f.text();
    const parsed = parseInventoryCsv(text);
    if (!parsed.ok) {
      setMessageTone("error");
      setMessage(
        parsed.errors.map((e) => `行${e.line}: ${e.message}`).join("\n"),
      );
      return;
    }
    const json = rowsToJsonForRpc(parsed.rows);
    startTransition(() => {
      void importProductCsvRowsAction(json).then((r) => {
        if (r.ok) {
          setMessageTone("success");
          setMessage("CSV の取り込みが完了しました。");
          router.refresh();
        } else {
          setMessageTone("error");
          setMessage(r.message);
        }
      });
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/10" />
        <div className="absolute -right-40 top-48 h-80 w-80 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/10" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="flex flex-col gap-1 border-b border-slate-200/80 pb-8 dark:border-slate-800/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            SCR-INV-LIST
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                在庫一覧
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                商品グループと SKU
                を横断して検索し、手動で数量を更新できます。CSV
                での一括取込みとバーコード入庫にも対応しています。
              </p>
            </div>
            <Link
              href="/inventory/movements"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <IconHistory className="h-4 w-4 text-slate-400" />
              入出庫履歴
            </Link>
          </div>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="商品グループ"
            value={summary.groupCount}
            hint="親商品の数"
            icon={<IconLayers className="h-5 w-5" />}
            tone="default"
          />
          <SummaryCard
            label="SKU 数"
            value={summary.skuCount}
            hint="アクティブな品番"
            icon={<IconTag className="h-5 w-5" />}
            tone="default"
          />
          <SummaryCard
            label="総在庫数"
            value={summary.totalQty}
            hint="全 SKU 合算"
            icon={<IconCube className="h-5 w-5" />}
            tone="default"
          />
          <SummaryCard
            label="在庫アラート"
            value={summary.alertCount}
            hint="発注点・安全在庫を下回る SKU"
            icon={<IconAlert className="h-5 w-5" />}
            tone={summary.alertCount > 0 ? "warn" : "default"}
          />
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="商品名・グループコード・SKU・JAN で検索…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-800"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <a
                href="/api/inventory/csv-template"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700"
              >
                <IconDownload className="h-4 w-4" />
                テンプレ DL
              </a>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={pending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                <IconUpload className="h-4 w-4" />
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
            </div>
          </div>
        </div>

        {message ? (
          <div
            role="status"
            className={`mt-6 rounded-2xl border px-5 py-4 text-sm leading-relaxed shadow-sm ${
              messageTone === "success"
                ? "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
                : messageTone === "error"
                  ? "border-red-200/80 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                  : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
            }`}
          >
            <pre className="whitespace-pre-wrap font-sans">{message}</pre>
          </div>
        ) : null}

        <BarcodeInboundPanel
          disabled={pending}
          onResult={(msg, tone) => {
            setMessage(msg);
            setMessageTone(tone ?? "info");
          }}
          onSuccess={() => router.refresh()}
        />

        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            商品グループ
          </h2>
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-8 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <IconCube className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-base font-medium text-slate-800 dark:text-slate-200">
                  表示できる商品がありません
                </p>
                <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                  検索条件を変えるか、CSV
                  テンプレートからデータを取り込んでください。
                </p>
              </div>
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
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone: "default" | "warn";
}) {
  const warn = tone === "warn" && value > 0;
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-5 shadow-card transition hover:shadow-card-hover ${
        warn
          ? "border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/80 dark:border-amber-900/40 dark:from-amber-950/50 dark:to-orange-950/30"
          : "border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
            {value.toLocaleString("ja-JP")}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            warn
              ? "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
              : "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300"
          }`}
        >
          {icon}
        </div>
      </div>
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
  const totalQty = skus.reduce((a, s) => a + s.quantity, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 ${
            open ? "rotate-0" : ""
          }`}
        >
          <IconChevron
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-slate-900 dark:text-white">
              {group.name}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {group.group_code}
            </span>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300">
              {skus.length} SKU
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              合計在庫{" "}
              <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                {totalQty.toLocaleString("ja-JP")}
              </span>
            </span>
          </div>
        </div>
      </button>
      {open ? (
        <div className="border-t border-slate-100 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">JAN</th>
                  <th className="px-5 py-3">バリエーション</th>
                  <th className="px-5 py-3 text-right">現在庫</th>
                  <th className="px-5 py-3 text-right">更新</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
  const inactive = !sku.is_active;

  return (
    <tr
      className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 ${
        inactive ? "opacity-60" : ""
      }`}
    >
      <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
        {sku.sku_code}
        {inactive ? (
          <span className="ml-2 rounded bg-slate-200 px-1.5 text-[10px] font-sans font-normal text-slate-600 dark:bg-slate-700 dark:text-slate-400">
            無効
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
        {sku.jan_code}
      </td>
      <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
        <span className="leading-relaxed">
          {[sku.name_variant, sku.color, sku.size].filter(Boolean).join(" · ") ||
            "—"}
        </span>
        {alert ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">
            <IconAlert className="h-3 w-3 shrink-0" />
            アラート
            {rec > 0 ? ` · 推奨 ${rec}` : ""}
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3.5 text-right">
        <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-white">
          {sku.quantity.toLocaleString("ja-JP")}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="inline-flex items-center justify-end gap-2">
          <input
            type="number"
            min={0}
            className="h-9 w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 text-right font-mono text-sm tabular-nums text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
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
            className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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
  onResult: (s: string | null, tone?: "info" | "success" | "error") => void;
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
      onResult(
        "このブラウザはカメラスキャンに未対応です。JAN を手入力してください。",
        "info",
      );
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
              onResult(
                "JAN を読み取りました。数量を確認して入庫してください。",
                "success",
              );
              await stopCamera();
            }
          } catch {
            /* ignore */
          }
        })();
      }, 300);
    } catch {
      onResult(
        "カメラを起動できませんでした。ブラウザの権限と HTTPS / localhost を確認してください。",
        "error",
      );
    }
  }

  function submitInbound() {
    onResult(null);
    const qn = parseInt(qty, 10);
    if (!jan.trim() || Number.isNaN(qn) || qn <= 0) {
      onResult("JAN と数量（1 以上）を入力してください。", "error");
      return;
    }
    void barcodeInboundAction(jan.trim(), qn).then((r) => {
      if (r.ok) {
        onResult("入庫を記録しました。", "success");
        setJan("");
        setQty("1");
        onSuccess();
      } else {
        onResult(r.message, "error");
      }
    });
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-slate-900">
      <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-500/[0.07] to-violet-500/[0.05] px-5 py-4 dark:border-slate-800 dark:from-indigo-500/10 dark:to-violet-500/5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm dark:bg-indigo-500">
            <IconScan className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              バーコード入庫
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              JAN をスキャンまたは入力し、入庫数量を指定します（履歴区分:{" "}
              <code className="rounded bg-white/60 px-1 font-mono text-[11px] dark:bg-slate-800/80">
                barcode_inbound
              </code>
              ）
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-2 lg:gap-8 lg:p-6">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                JAN コード
              </label>
              <input
                value={jan}
                onChange={(e) => setJan(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 font-mono text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800/50 dark:focus:border-indigo-400 dark:focus:bg-slate-800"
                placeholder="4901234567890"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                入庫数量
              </label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm tabular-nums transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800/50 dark:focus:border-indigo-400 dark:focus:bg-slate-800"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => submitInbound()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <IconCheck className="h-4 w-4" />
              入庫を確定
            </button>
            <button
              type="button"
              disabled={disabled || scanning}
              onClick={() => void startScan()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <IconCamera className="h-4 w-4" />
              カメラでスキャン
            </button>
            {scanning ? (
              <button
                type="button"
                onClick={() => void stopCamera()}
                className="inline-flex h-11 items-center px-2 text-sm font-medium text-red-600 underline-offset-4 hover:underline dark:text-red-400"
              >
                停止
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            プレビュー
          </p>
          <div className="flex min-h-[200px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-700">
            <video
              ref={videoRef}
              className={`w-full object-cover ${scanning ? "aspect-video min-h-[180px]" : "hidden h-0"}`}
              muted
              playsInline
            />
            {!scanning ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <IconCamera className="h-8 w-8 text-slate-600" />
                <p className="text-xs text-slate-500">
                  「カメラでスキャン」でプレビューが表示されます
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

type BarcodeDetectorWindow = {
  BarcodeDetector: new (opts: { formats: string[] }) => {
    detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>; 
  };
};

function IconSearch(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconLayers(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}

function IconTag(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function IconCube(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.27 6.96 8.66 4.99 8.66-4.99M12 22.08V12" />
    </svg>
  );
}

function IconAlert(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function IconDownload(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function IconUpload(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

function IconHistory(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </svg>
  );
}

function IconChevron(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconScan(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </svg>
  );
}

function IconCamera(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function IconCheck(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
