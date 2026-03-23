"use client";

import {
  adjustSkuQuantityAction,
  barcodeInboundAction,
  importProductCsvRowsAction,
  resolveJanForInboundAction,
} from "@/app/actions/inventory";
import { parseInventoryCsv, rowsToJsonForRpc } from "@/lib/inventory/csv";
import {
  isInventoryAlert,
  recommendedOrderQty,
} from "@/lib/inventory/alerts";
import { startVideoBarcodeScan } from "@/lib/barcode/video-barcode-scan";
import {
  explainGetUserMediaFailure,
  getCameraPrerequisiteMessage,
} from "@/lib/media/camera-access-help";
import { getScanCameraStream } from "@/lib/media/scan-camera";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
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
    <main className="relative min-h-screen bg-transparent pb-24">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-slate-300/[0.12] blur-[100px] dark:bg-slate-500/[0.07]" />
        <div className="absolute -right-24 top-40 h-[22rem] w-[22rem] rounded-full bg-slate-400/[0.1] blur-[90px] dark:bg-slate-600/[0.06]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-96 rounded-full bg-slate-200/[0.2] blur-[80px] dark:bg-slate-800/20" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <header className="border-b border-slate-200/90 pb-8 dark:border-slate-800/90">
          <p className="text-xs font-mono text-slate-500">SCR-INV-LIST</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            在庫一覧
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            親商品（グループ）と SKU
            をまたいで検索し、数量をその場で更新できます。CSV
            によるマスタ反映とバーコード入庫で、倉庫・店舗の運用に合わせた入庫フローもまとめて扱えます。
          </p>
          <div className="mt-3">
            <Link
              href="/inventory/movements"
              className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
            >
              入出庫履歴を見る
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
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/25 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <a
                href="/api/inventory/csv-template"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700"
              >
                <IconDownload className="h-4 w-4" />
                CSV ダウンロード
              </a>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={pending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
                ? "border-slate-300/90 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100"
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

        <section className="mt-14">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              Catalog
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              商品グループ
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-slate-500 dark:text-slate-400">
              行を開いて SKU
              ごとの在庫とアラートを確認・更新できます。
            </p>
          </div>
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
                  検索条件を変えるか、上部の「CSV
                  ダウンロード」でフォーマットを取得してから取り込んでください。
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
          : "border-slate-200/90 bg-white/95 shadow-sm ring-1 ring-slate-900/[0.02] backdrop-blur-sm dark:border-slate-800/90 dark:bg-slate-900/95 dark:ring-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
              : "bg-slate-200/80 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function ProductGroupImageSlot({ groupCode }: { groupCode: string }) {
  return (
    <div className="w-full">
      <div
        className="aspect-square w-full min-h-[5.5rem] overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-100/90 dark:border-slate-600 dark:bg-slate-800/60"
        aria-hidden
      >
        <div className="flex h-full flex-col items-center justify-center gap-1.5 px-2 py-3 text-center">
          <IconImage className="h-7 w-7 shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="text-[10px] font-semibold leading-tight text-slate-600 dark:text-slate-300">
            商品画像
          </span>
          <span className="line-clamp-2 px-1 font-mono text-[9px] text-slate-400 dark:text-slate-500">
            {groupCode}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[9px] leading-tight text-slate-400 dark:text-slate-500">
        将来ここに画像を表示
      </p>
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
  const [open, setOpen] = useState(false);
  const totalQty = skus.reduce((a, s) => a + s.quantity, 0);
  const panelId = `inventory-group-${group.id}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-slate-900">
      <div
        className={`grid grid-cols-[minmax(7.5rem,9.5rem)_1fr_auto] gap-x-4 gap-y-0 p-4 sm:p-5 ${open ? "pb-4 sm:pb-5" : ""}`}
      >
        <div className={`self-start ${open ? "row-span-2" : ""}`}>
          <ProductGroupImageSlot groupCode={group.group_code} />
        </div>

        <div className="col-start-2 row-start-1 min-w-0 self-center py-1 pr-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              {group.name}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {group.group_code}
            </span>
            <span className="rounded-full bg-slate-200/90 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700/60 dark:text-slate-200">
              {skus.length} SKU
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              合計在庫{" "}
              <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                {totalQty.toLocaleString("ja-JP")}
              </span>
            </span>
          </div>
        </div>

        <div className="col-start-3 row-start-1 flex shrink-0 justify-end self-start pt-0.5">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <span className="sr-only">
              {open ? "SKU 一覧を閉じる" : "SKU 一覧を開く"}
            </span>
            <IconChevron
              className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {open ? (
          <div
            id={panelId}
            role="region"
            aria-label={`${group.name} の SKU 一覧`}
            className="col-span-2 col-start-2 row-start-2 mt-4 min-w-0 border-t border-slate-100 pt-4 dark:border-slate-800"
          >
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
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
  const router = useRouter();

  function rowNavigate(e: MouseEvent<HTMLTableRowElement>) {
    if (
      (e.target as HTMLElement).closest(
        "button, input, a, textarea, select",
      )
    ) {
      return;
    }
    router.push(`/inventory/sku/${sku.id}`);
  }

  return (
    <tr
      aria-label={`${sku.sku_code} の商品詳細へ（行をクリック）`}
      onClick={rowNavigate}
      className={`cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 ${
        inactive ? "opacity-60" : ""
      }`}
    >
      <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
        <span className="rounded px-0.5">{sku.sku_code}</span>
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="leading-relaxed">
            {[sku.name_variant, sku.color, sku.size].filter(Boolean).join(
              " · ",
            ) || "—"}
          </span>
          {alert ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">
              <IconAlert className="h-3 w-3 shrink-0" />
              アラート
              {rec > 0 ? ` · 推奨 ${rec}` : ""}
            </span>
          ) : null}
        </div>
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
            className="h-9 w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 text-right font-mono text-sm tabular-nums text-slate-900 transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400"
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
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
  const [productName, setProductName] = useState("");
  const [jan, setJan] = useState("");
  const [qty, setQty] = useState("1");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanCleanupRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);

  async function stopCamera() {
    activeRef.current = false;
    scanCleanupRef.current?.();
    scanCleanupRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }

  async function startScan() {
    onResult(null);
    const prerequisite = getCameraPrerequisiteMessage();
    if (prerequisite) {
      onResult(prerequisite, "error");
      return;
    }
    await stopCamera();
    try {
      const stream = await getScanCameraStream();
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        onResult("カメラプレビューの準備に失敗しました。", "error");
        return;
      }
      v.srcObject = stream;
      await v.play();
      setScanning(true);
      activeRef.current = true;
      const cleanup = await startVideoBarcodeScan({
        videoElement: v,
        preferNative: true,
        nativeFormats: [
          "ean_13",
          "ean_8",
          "code_128",
          "code_39",
          "itf",
          "upc_a",
          "upc_e",
          "qr_code",
        ],
        onDecode: (text) => {
          if (!activeRef.current) return;
          setJan(text);
          onResult(
            "JAN を読み取りました。数量を確認して入庫してください。",
            "success",
          );
          void stopCamera();
        },
      });
      scanCleanupRef.current = cleanup;
    } catch (e) {
      onResult(explainGetUserMediaFailure(e), "error");
    }
  }

  async function tryFillJanFromQuery(raw: string, fromProductNameField: boolean) {
    const t = raw.trim();
    if (!t) return;
    if (fromProductNameField && jan.trim()) return;
    const r = await resolveJanForInboundAction(t);
    if (r.ok) {
      setJan(r.jan);
      if (fromProductNameField) {
        onResult(`JAN をセットしました: ${r.jan}`, "info");
      }
    }
  }

  function submitInbound() {
    onResult(null);
    const qn = parseInt(qty, 10);
    const j = jan.trim();
    const p = productName.trim();
    if (Number.isNaN(qn) || qn <= 0) {
      onResult("入庫数量は 1 以上を入力してください。", "error");
      return;
    }
    if (!j && !p) {
      onResult("商品名または JAN コードのいずれかを入力してください。", "error");
      return;
    }

    let lastErr = "";
    const pick = async () => {
      if (j) {
        const r = await resolveJanForInboundAction(j);
        if (r.ok) return r.jan;
        lastErr = r.message;
      }
      if (p) {
        const r = await resolveJanForInboundAction(p);
        if (r.ok) return r.jan;
        lastErr = r.message;
      }
      return null;
    };

    void pick().then((targetJan) => {
      if (!targetJan) {
        onResult(lastErr || "商品を特定できませんでした。", "error");
        return;
      }
      void barcodeInboundAction(targetJan, qn).then((r) => {
        if (r.ok) {
          onResult("入庫を記録しました。", "success");
          setJan("");
          setProductName("");
          setQty("1");
          onSuccess();
        } else {
          onResult(r.message, "error");
        }
      });
    });
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-slate-900">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-100/90 to-slate-50 px-5 py-4 dark:border-slate-800 dark:from-slate-800/80 dark:to-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-800 text-white shadow-sm dark:border-slate-600 dark:bg-slate-700">
            <IconScan className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              バーコード入庫
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              商品名または JAN を入力し、入庫数量を指定します（履歴区分:{" "}
              <code className="rounded bg-white/60 px-1 font-mono text-[11px] dark:bg-slate-800/80">
                barcode_inbound
              </code>
              ）
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-2 lg:items-stretch lg:gap-8 lg:p-6">
        <div className="flex min-h-0 flex-col">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            プレビュー
          </p>
          <div className="flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-inner dark:border-slate-700 lg:min-h-[280px]">
            <video
              ref={videoRef}
              className={`w-full flex-1 object-cover ${scanning ? "min-h-[200px]" : "hidden h-0 min-h-0"}`}
              muted
              playsInline
            />
            {!scanning ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/80 text-slate-500">
                  <IconCamera className="h-7 w-7" />
                </div>
                <p className="max-w-[16rem] text-xs leading-relaxed text-slate-500">
                  「カメラでスキャン」を押すと、ここにライブプレビューが表示されます
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-1 content-start gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-y-3 lg:py-0">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              商品名
            </label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              onBlur={() => void tryFillJanFromQuery(productName, true)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm transition focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-800/50 dark:focus:border-slate-400 dark:focus:bg-slate-800"
              placeholder="親商品名・バリエーション名など"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              入庫数量
            </label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm tabular-nums transition focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-800/50 dark:focus:border-slate-400 dark:focus:bg-slate-800"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              JAN コード
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={jan}
                onChange={(e) => setJan(e.target.value)}
                onBlur={() => void tryFillJanFromQuery(jan, false)}
                className="h-11 min-w-[min(100%,12rem)] flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 font-mono text-sm transition focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-800/50 dark:focus:border-slate-400 dark:focus:bg-slate-800"
                placeholder="4901234567890"
              />
              <div className="flex shrink-0 flex-nowrap items-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => submitInbound()}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <IconCheck className="h-4 w-4" />
                  入庫を確定
                </button>
                <button
                  type="button"
                  disabled={disabled || scanning}
                  onClick={() => void startScan()}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <IconCamera className="h-4 w-4" />
                  カメラでスキャン
                </button>
                {scanning ? (
                  <button
                    type="button"
                    onClick={() => void stopCamera()}
                    className="inline-flex h-11 shrink-0 items-center px-2 text-sm font-medium text-red-600 underline-offset-4 hover:underline dark:text-red-400"
                  >
                    停止
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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

function IconImage(props: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
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
