"use client";

import {
  adjustSkuQuantityAction,
  barcodeInboundAction,
  importProductCsvRowsAction,
  resolveJanForInboundAction,
} from "@/app/actions/inventory";
import { parseInventoryCsv, rowsToJsonForRpc } from "@/lib/inventory/csv";
import {
  getInventoryAlertLevel,
  inventoryAlertBadgeClass,
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
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { flushSync } from "react-dom";

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

/** バーコード入庫の絞り込み：グループ名・コード、SKU・JAN・バリエーション・色・サイズなど */
function groupMatchesInboundNeedle(g: GroupRow, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  if (g.name.toLowerCase().includes(n) || g.group_code.toLowerCase().includes(n)) {
    return true;
  }
  for (const s of g.product_skus ?? []) {
    if (!s.is_active) continue;
    const hay = [
      s.sku_code,
      s.jan_code,
      s.name_variant ?? "",
      s.color ?? "",
      s.size ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (hay.includes(n)) return true;
  }
  return false;
}

function filterGroupsForInboundFields(
  groups: GroupRow[],
  productRaw: string,
  janRaw: string,
): GroupRow[] {
  const p = productRaw.trim().toLowerCase();
  const j = janRaw.trim().toLowerCase();
  if (!p && !j) return groups;
  return groups.filter((g) => {
    if (p && groupMatchesInboundNeedle(g, p)) return true;
    if (j && groupMatchesInboundNeedle(g, j)) return true;
    return false;
  });
}

/** 確定 JAN に対応する SKU をクライアント一覧から解決（確認ダイアログ用） */
function lookupSkuContextByResolvedJan(
  groups: GroupRow[],
  resolvedJan: string,
): {
  groupName: string;
  groupCode: string;
  skuCode: string;
  variantLabel: string;
} | null {
  const target = resolvedJan.trim();
  if (!target) return null;
  for (const g of groups) {
    for (const s of g.product_skus ?? []) {
      if (!s.is_active) continue;
      if (s.jan_code.trim() !== target) continue;
      const variantLabel = [s.name_variant, s.color, s.size]
        .filter((x) => x != null && String(x).trim() !== "")
        .map((x) => String(x).trim())
        .join(" · ");
      return {
        groupName: g.name,
        groupCode: g.group_code,
        skuCode: s.sku_code,
        variantLabel: variantLabel.length > 0 ? variantLabel : "—",
      };
    }
  }
  return null;
}

export function InventoryListClient({ groups, summary }: Props) {
  const router = useRouter();
  const [inboundCatalogProduct, setInboundCatalogProduct] = useState("");
  const [inboundCatalogJan, setInboundCatalogJan] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">(
    "info",
  );
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onInboundCatalogFilter = useCallback((product: string, jan: string) => {
    setInboundCatalogProduct(product);
    setInboundCatalogJan(jan);
  }, []);

  const catalogGroups = useMemo(
    () =>
      filterGroupsForInboundFields(groups, inboundCatalogProduct, inboundCatalogJan),
    [groups, inboundCatalogProduct, inboundCatalogJan],
  );

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
    <div className="relative min-h-0">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Inventory
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              在庫一覧
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-500">
              親商品（グループ）と SKU
              の数量をその場で更新できます。CSV
              によるマスタ反映とバーコード入庫で、倉庫・店舗の運用に合わせた入庫フローもまとめて扱えます。
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <a
              href="/api/inventory/csv-export"
              title="アクティブなグループ・SKU の現在値を、取込と同じ列形式で出力します（UTF-8）。"
              className="btn btn-foreground flex-1 sm:flex-initial sm:min-w-[8.5rem]"
            >
              <IconDownload className="h-4 w-4 shrink-0" />
              CSV エクスポート
            </a>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="btn btn-foreground flex-1 px-5 font-semibold sm:flex-initial sm:min-w-[8.5rem]"
            >
              <IconUpload className="h-4 w-4 shrink-0" />
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
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {message ? (
          <div
            role="status"
            className={`mt-5 rounded-2xl border px-4 py-3.5 text-sm leading-relaxed shadow-sm sm:px-5 sm:py-4 ${
              messageTone === "success"
                ? "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]"
                : messageTone === "error"
                  ? "border-red-200/80 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
                  : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]"
            }`}
          >
            <pre className="whitespace-pre-wrap font-sans">{message}</pre>
          </div>
        ) : null}

        <BarcodeInboundPanel
          groups={groups}
          disabled={pending}
          onCatalogFilterChange={onInboundCatalogFilter}
          onResult={(msg, tone) => {
            setMessage(msg);
            setMessageTone(tone ?? "info");
          }}
          onSuccess={() => router.refresh()}
        />

        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
              Catalog
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--foreground)]">
              商品グループ
            </h2>
            <p className="mt-1 max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
              行を開いて SKU
              ごとの在庫とアラートを確認・更新できます。バーコード入庫の「商品名など」「JAN
              コード」に入力がある間、一致するグループだけを表示します。
            </p>
          </div>
          <div className="space-y-4">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-white/60 px-8 py-16 text-center dark:border-[var(--border)] dark:bg-[var(--surface)]/40">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] dark:bg-[var(--surface-muted)]">
                  <IconCube className="h-7 w-7 text-neutral-400" />
                </div>
                <p className="text-base font-medium text-neutral-800 dark:text-neutral-200">
                  表示できる商品がありません
                </p>
                <p className="mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
                  CSV アップロードでマスタを取り込むか、データを登録してください。
                </p>
              </div>
            ) : catalogGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-200/80 bg-amber-50/50 px-8 py-14 text-center dark:border-amber-900/45 dark:bg-amber-950/22">
                <p className="text-base font-medium text-neutral-800 dark:text-neutral-200">
                  入力に一致する商品グループがありません
                </p>
                <p className="mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
                  バーコード入庫の商品名など・JAN の入力を変えるか消すと、一覧が戻ります。
                </p>
              </div>
            ) : (
              catalogGroups.map((g) => (
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
          ? "border-[var(--border-strong)] bg-[var(--surface-muted)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
            {value.toLocaleString("ja-JP")}
          </p>
          <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            warn
              ? "bg-[var(--surface-muted)] text-[var(--foreground)] ring-1 ring-[var(--border-strong)]"
              : "bg-[var(--surface-muted)] text-neutral-600 ring-1 ring-[var(--border)] dark:text-neutral-300"
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
        className="aspect-square w-full min-h-[5.5rem] overflow-hidden rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)]/90 dark:border-[var(--border)] dark:bg-[var(--surface-muted)]/60"
        aria-hidden
      >
        <div className="flex h-full flex-col items-center justify-center gap-1.5 px-2 py-3 text-center">
          <IconImage className="h-7 w-7 shrink-0 text-neutral-400 dark:text-neutral-500" />
          <span className="text-[10px] font-semibold leading-tight text-neutral-600 dark:text-neutral-300">
            商品画像
          </span>
          <span className="line-clamp-2 px-1 font-mono text-[9px] text-neutral-400 dark:text-neutral-500">
            {groupCode}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[9px] leading-tight text-neutral-400 dark:text-neutral-500">
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
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
      <div
        className={`grid grid-cols-[minmax(7.5rem,9.5rem)_1fr_auto] gap-x-4 gap-y-0 p-4 sm:p-5 ${open ? "pb-4 sm:pb-5" : ""}`}
      >
        <div className={`self-start ${open ? "row-span-2" : ""}`}>
          <ProductGroupImageSlot groupCode={group.group_code} />
        </div>

        <div className="col-start-2 row-start-1 min-w-0 self-center py-1 pr-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-[var(--foreground)]">
              {group.name}
            </span>
            <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-xs text-neutral-600 dark:text-neutral-300">
              {group.group_code}
            </span>
            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-medium text-neutral-700 ring-1 ring-[var(--border)] dark:text-neutral-200">
              {skus.length} SKU
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              合計在庫{" "}
              <span className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
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
            className="btn-icon bg-[var(--surface-muted)] text-neutral-600 hover:text-[var(--foreground)] dark:hover:text-white"
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
            className="col-span-2 col-start-2 row-start-2 mt-4 min-w-0 border-t border-[var(--border)] pt-4 dark:border-[var(--border)]"
          >
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] dark:border-[var(--border)]">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/90 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-[var(--border)] dark:bg-[var(--surface-muted)]/40 dark:text-neutral-400">
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">JAN</th>
                    <th className="px-5 py-3">バリエーション</th>
                    <th className="px-5 py-3 text-right">現在庫</th>
                    <th className="px-5 py-3 text-right">更新</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
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
  const alertLevel = getInventoryAlertLevel(
    sku.quantity,
    sku.reorder_point,
    sku.safety_stock,
  );
  const rec = recommendedOrderQty(sku.quantity, sku.safety_stock);
  const inactive = !sku.is_active;
  const detailHref = `/inventory/sku/${sku.id}`;

  return (
    <tr
      className={`transition-colors ${
        inactive ? "opacity-60" : ""
      }`}
    >
      <td className="px-5 py-3.5 font-mono text-xs font-medium text-neutral-800 dark:text-neutral-200">
        <Link
          href={detailHref}
          className="rounded px-0.5 text-neutral-800 underline-offset-2 hover:underline dark:text-neutral-200"
        >
          {sku.sku_code}
        </Link>
        {inactive ? (
          <span className="ml-2 rounded bg-neutral-200 px-1.5 dark:bg-[var(--surface-muted)] text-[10px] font-sans font-normal text-neutral-600 dark:bg-[var(--surface-muted)] dark:text-neutral-400">
            無効
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3.5 font-mono text-xs text-neutral-600 dark:text-neutral-400">
        <Link
          href={detailHref}
          className="text-neutral-600 underline-offset-2 hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {sku.jan_code}
        </Link>
      </td>
      <td className="px-5 py-3.5 text-neutral-700 dark:text-neutral-300">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="leading-relaxed">
            {[sku.name_variant, sku.color, sku.size].filter(Boolean).join(
              " · ",
            ) || "—"}
          </span>
          {alert && alertLevel ? (
            <span className={inventoryAlertBadgeClass(alertLevel)}>
              <IconAlert className="h-3 w-3 shrink-0 opacity-80" />
              アラート
              {rec > 0 ? ` · 推奨 ${rec}` : ""}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-5 py-3.5 text-right">
        <span className="text-base font-semibold tabular-nums text-[var(--foreground)]">
          {sku.quantity.toLocaleString("ja-JP")}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="inline-flex items-center justify-end gap-2">
          <input
            type="number"
            min={0}
            className="h-9 w-[4.5rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-right font-mono text-sm tabular-nums text-[var(--foreground)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--foreground)] dark:focus:border-[var(--border-strong)]"
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
            className="btn btn-sm btn-foreground disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </td>
    </tr>
  );
}

function BarcodeInboundPanel({
  groups,
  disabled,
  onCatalogFilterChange,
  onResult,
  onSuccess,
}: {
  groups: GroupRow[];
  disabled: boolean;
  onCatalogFilterChange?: (productText: string, janText: string) => void;
  onResult: (s: string | null, tone?: "info" | "success" | "error") => void;
  onSuccess: () => void;
}) {
  const [productName, setProductName] = useState("");
  const [jan, setJan] = useState("");
  const [qty, setQty] = useState("1");
  const [scanning, setScanning] = useState(false);
  /** 入庫 API 実行前の確認ダイアログ */
  const [confirmInbound, setConfirmInbound] = useState<{
    resolvedJan: string;
    qty: number;
    productNote: string;
    janField: string;
    groupName: string | null;
    groupCode: string | null;
    skuCode: string | null;
    variantLabel: string | null;
  } | null>(null);
  /** 「カメラでスキャン」押下後〜停止まで。プレビュー列と video のマウントに使う */
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanCleanupRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);
  const cameraSessionRef = useRef(0);

  useEffect(() => {
    onCatalogFilterChange?.(productName, jan);
  }, [productName, jan, onCatalogFilterChange]);

  async function stopCamera() {
    cameraSessionRef.current += 1;
    activeRef.current = false;
    scanCleanupRef.current?.();
    scanCleanupRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
    setShowCameraPreview(false);
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
    const session = cameraSessionRef.current;
    flushSync(() => {
      setShowCameraPreview(true);
    });
    try {
      const stream = await getScanCameraStream();
      if (session !== cameraSessionRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setShowCameraPreview(false);
        onResult("カメラプレビューの準備に失敗しました。", "error");
        return;
      }
      v.srcObject = stream;
      await v.play();
      if (session !== cameraSessionRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }
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
      if (session !== cameraSessionRef.current) {
        cleanup();
        return;
      }
      scanCleanupRef.current = cleanup;
    } catch (e) {
      setShowCameraPreview(false);
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
      onResult("商品名などまたは JAN コードのいずれかを入力してください。", "error");
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
      const ctx = lookupSkuContextByResolvedJan(groups, targetJan);
      setConfirmInbound({
        resolvedJan: targetJan,
        qty: qn,
        productNote: p,
        janField: j,
        groupName: ctx?.groupName ?? null,
        groupCode: ctx?.groupCode ?? null,
        skuCode: ctx?.skuCode ?? null,
        variantLabel: ctx?.variantLabel ?? null,
      });
    });
  }

  function cancelInboundConfirm() {
    setConfirmInbound(null);
  }

  function runConfirmedInbound() {
    if (!confirmInbound || disabled) return;
    const { resolvedJan, qty: qn } = confirmInbound;
    setConfirmInbound(null);
    void barcodeInboundAction(resolvedJan, qn).then((r) => {
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
  }

  useEffect(() => {
    if (!confirmInbound) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancelInboundConfirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmInbound]);

  return (
    <>
    <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
      <div className="border-b border-[var(--border)] bg-gradient-to-r from-[var(--surface-muted)] to-[var(--surface)] px-5 py-4 dark:border-[var(--border)] dark:from-[var(--surface-muted)] dark:to-[var(--surface)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-sm dark:border-[var(--border)] dark:bg-[var(--surface-muted)]">
            <IconScan className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              バーコード入庫
            </h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              商品名などまたは JAN を入力し、入庫数量を指定します（履歴区分:{" "}
              <code className="rounded bg-white/60 px-1 font-mono text-[11px] dark:bg-[var(--surface-muted)]/80">
                barcode_inbound
              </code>
              ）
            </p>
          </div>
        </div>
      </div>
      <div
        className={`grid gap-6 p-5 lg:p-6 ${showCameraPreview ? "lg:grid-cols-2 lg:items-stretch lg:gap-8" : ""}`}
      >
        <div className="grid min-w-0 grid-cols-1 content-start gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-y-3 lg:py-0">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
              商品名など
            </label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              onBlur={() => void tryFillJanFromQuery(productName, true)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/80 px-3 text-sm transition focus:border-[var(--border-strong)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 dark:border-[var(--border)] dark:bg-[var(--surface-muted)]/50 dark:focus:border-[var(--border-strong)] dark:focus:bg-[var(--surface)]"
              placeholder="グループ名・コード、SKU、バリエーション、商品名…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
              入庫数量
            </label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/80 px-3 text-sm tabular-nums transition focus:border-[var(--border-strong)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 dark:border-[var(--border)] dark:bg-[var(--surface-muted)]/50 dark:focus:border-[var(--border-strong)] dark:focus:bg-[var(--surface)]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
              JAN コード
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={jan}
                onChange={(e) => setJan(e.target.value)}
                onBlur={() => void tryFillJanFromQuery(jan, false)}
                className="h-11 min-w-[min(100%,12rem)] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/80 px-3 font-mono text-sm transition focus:border-[var(--border-strong)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 dark:border-[var(--border)] dark:bg-[var(--surface-muted)]/50 dark:focus:border-[var(--border-strong)] dark:focus:bg-[var(--surface)]"
                placeholder="4901234567890"
              />
              <div className="flex shrink-0 flex-nowrap items-center gap-2">
                <button
                  type="button"
                  disabled={disabled || confirmInbound != null}
                  onClick={() => submitInbound()}
                  className="btn btn-foreground px-5 font-semibold text-neutral-800 dark:text-[var(--foreground)]"
                >
                  <IconCheck className="h-4 w-4" />
                  入庫を確定
                </button>
                <button
                  type="button"
                  disabled={disabled || showCameraPreview}
                  onClick={() => void startScan()}
                  className="btn"
                >
                  <IconCamera className="h-4 w-4" />
                  カメラでスキャン
                </button>
                {showCameraPreview ? (
                  <button
                    type="button"
                    onClick={() => void stopCamera()}
                    className="btn-stop"
                  >
                    停止
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {showCameraPreview ? (
          <div className="flex min-h-0 flex-col">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              プレビュー
            </p>
            <div className="relative flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-slate-950 shadow-inner dark:border-[var(--border)] lg:min-h-[280px]">
              <video
                ref={videoRef}
                className="min-h-[200px] w-full flex-1 object-cover"
                muted
                playsInline
              />
              {!scanning ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/92 px-4 py-12 text-center">
                  <div
                    className="h-9 w-9 shrink-0 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-300"
                    aria-hidden
                  />
                  <p className="max-w-[16rem] text-xs leading-relaxed text-neutral-400">
                    カメラを起動しています…
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>

    {confirmInbound ? (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          aria-label="閉じる"
          onClick={cancelInboundConfirm}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inbound-confirm-title"
          className="relative z-[1] w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl dark:border-[var(--border)] dark:bg-[var(--surface)]"
        >
          <h3
            id="inbound-confirm-title"
            className="text-base font-semibold text-[var(--foreground)]"
          >
            入庫の確認
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            次の内容で在庫に加算します。よろしいですか？
          </p>
          <dl className="mt-4 space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-3 text-sm dark:bg-[var(--surface-muted)]/40">
            {confirmInbound.groupName || confirmInbound.skuCode ? (
              <>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <dt className="shrink-0 text-neutral-500 dark:text-neutral-400">
                    商品グループ
                  </dt>
                  <dd className="min-w-0 max-w-full text-right font-medium text-[var(--foreground)]">
                    <span className="break-words">{confirmInbound.groupName ?? "—"}</span>
                    {confirmInbound.groupCode ? (
                      <span className="mt-0.5 block font-mono text-xs font-normal text-neutral-500 dark:text-neutral-400">
                        {confirmInbound.groupCode}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[var(--border)]/70 pt-2.5">
                  <dt className="text-neutral-500 dark:text-neutral-400">SKU</dt>
                  <dd className="break-all font-mono text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                    {confirmInbound.skuCode ?? "—"}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[var(--border)]/70 pt-2.5">
                  <dt className="shrink-0 text-neutral-500 dark:text-neutral-400">名称</dt>
                  <dd className="min-w-0 max-w-[min(100%,14rem)] text-right text-[var(--foreground)] sm:max-w-[18rem]">
                    <span className="break-words">{confirmInbound.variantLabel ?? "—"}</span>
                  </dd>
                </div>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                在庫一覧に一致する SKU
                が見つかりませんでした。JAN はサーバーで解決済みです。表示を更新してから再度お試しください。
              </p>
            )}
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[var(--border)]/70 pt-2.5">
              <dt className="text-neutral-500 dark:text-neutral-400">加算数量</dt>
              <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                {confirmInbound.qty.toLocaleString("ja-JP")}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt className="text-neutral-500 dark:text-neutral-400">確定 JAN</dt>
              <dd className="break-all font-mono text-xs font-medium text-[var(--foreground)] sm:text-sm">
                {confirmInbound.resolvedJan}
              </dd>
            </div>
            {confirmInbound.janField &&
            confirmInbound.janField !== confirmInbound.resolvedJan ? (
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[var(--border)]/70 pt-2.5">
                <dt className="text-neutral-500 dark:text-neutral-400">入力 JAN</dt>
                <dd className="break-all font-mono text-xs text-[var(--foreground)]">
                  {confirmInbound.janField}
                </dd>
              </div>
            ) : null}
            {confirmInbound.productNote ? (
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[var(--border)]/70 pt-2.5">
                <dt className="text-neutral-500 dark:text-neutral-400">商品名など</dt>
                <dd className="min-w-0 flex-1 text-right text-[var(--foreground)]">
                  {confirmInbound.productNote}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={cancelInboundConfirm}
              className="btn"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => runConfirmedInbound()}
              className="btn-primary"
            >
              入庫する
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
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
