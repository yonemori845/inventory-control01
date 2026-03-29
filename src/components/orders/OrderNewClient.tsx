"use client";

import { placeOrderAction } from "@/app/actions/orders";
import { resolveJanForInboundAction } from "@/app/actions/inventory";
import { startVideoBarcodeScan } from "@/lib/barcode/video-barcode-scan";
import {
  explainGetUserMediaFailure,
  getCameraPrerequisiteMessage,
} from "@/lib/media/camera-access-help";
import { getScanCameraStream } from "@/lib/media/scan-camera";
import {
  DEFAULT_CONSUMPTION_TAX_RATE,
  formatYen,
  lineSubtotalExTax,
  orderTotalsFromLines,
} from "@/lib/pricing";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

export type OrderSkuOption = {
  id: string;
  sku_code: string;
  jan_code: string;
  name_variant: string | null;
  unit_price_ex_tax: number;
  quantity: number;
};

type CartLine = {
  sku: OrderSkuOption;
  quantity: number;
};

export function OrderNewClient({ skus }: { skus: OrderSkuOption[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [janInput, setJanInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanCleanupRef = useRef<(() => void) | null>(null);

  const skuByJan = useMemo(() => {
    const m = new Map<string, OrderSkuOption>();
    for (const s of skus) m.set(s.jan_code, s);
    return m;
  }, [skus]);

  const filtered = useMemo(() => {
    const n = query.trim().toLowerCase();
    if (!n) return skus.slice(0, 40);
    return skus
      .filter(
        (s) =>
          s.sku_code.toLowerCase().includes(n) ||
          s.jan_code.includes(n) ||
          (s.name_variant ?? "").toLowerCase().includes(n),
      )
      .slice(0, 60);
  }, [skus, query]);

  const totals = useMemo(() => {
    return orderTotalsFromLines(
      lines.map((l) => ({
        unitPriceExTax: l.sku.unit_price_ex_tax,
        quantity: l.quantity,
      })),
      DEFAULT_CONSUMPTION_TAX_RATE,
    );
  }, [lines]);

  const stopScan = useCallback(() => {
    scanCleanupRef.current?.();
    scanCleanupRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const el = videoRef.current;
    if (el) el.srcObject = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  function addSku(sku: OrderSkuOption, qty = 1) {
    setMessage(null);
    setLines((prev) => {
      const i = prev.findIndex((l) => l.sku.id === sku.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = {
          ...next[i],
          quantity: next[i].quantity + qty,
        };
        return next;
      }
      return [...prev, { sku, quantity: qty }];
    });
  }

  function setQty(skuId: string, q: number) {
    if (q < 1) {
      setLines((prev) => prev.filter((l) => l.sku.id !== skuId));
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.sku.id === skuId ? { ...l, quantity: q } : l,
      ),
    );
  }

  async function onResolveJan(raw: string) {
    const q = raw.trim();
    if (!q) return;
    const r = await resolveJanForInboundAction(q);
    if (!r.ok) {
      setMessage(r.message);
      return;
    }
    const sku = skuByJan.get(r.jan);
    if (!sku) {
      setMessage("JAN に対応する SKU が一覧にありません。");
      return;
    }
    addSku(sku, 1);
    setMessage(`${sku.sku_code} を追加しました。`);
  }

  async function startScan() {
    setMessage(null);
    const prerequisite = getCameraPrerequisiteMessage();
    if (prerequisite) {
      setMessage(prerequisite);
      return;
    }
    stopScan();
    try {
      const stream = await getScanCameraStream();
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setMessage(
          "カメラ要素の準備に失敗しました。ページを再読み込みしてお試しください。",
        );
        return;
      }
      v.srcObject = stream;
      await v.play();
      setScanning(true);
      const cleanup = await startVideoBarcodeScan({
        videoElement: v,
        preferNative: true,
        nativeFormats: [
          "ean_13",
          "ean_8",
          "code_128",
          "code_39",
          "qr_code",
        ],
        onDecode: (text) => {
          stopScan();
          void onResolveJan(text);
        },
      });
      scanCleanupRef.current = cleanup;
    } catch (e) {
      setMessage(explainGetUserMediaFailure(e));
    }
  }

  function onSubmit() {
    setMessage(null);
    if (lines.length === 0) {
      setMessage("明細を追加してください。");
      return;
    }
    const payload = lines.map((l) => ({
      sku_id: l.sku.id,
      quantity: l.quantity,
    }));
    startTransition(() => {
      void placeOrderAction(payload).then((r) => {
        if (r.ok) {
          router.push(`/orders/${r.orderId}`);
          router.refresh();
        } else {
          if (r.shortage?.length) {
            setMessage(
              r.shortage
                .map(
                  (s) =>
                    `${s.sku_code}: 必要 ${s.requested} / 在庫 ${s.available}${
                      s.reason === "inactive" ? "（無効 SKU）" : ""
                    }`,
                )
                .join(" / "),
            );
          } else {
            setMessage(r.message);
          }
        }
      });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)] lg:gap-8">
      <section className="space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            商品の追加
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            検索・JAN 手入力・カメラスキャンで明細に追加します。
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <input
              type="text"
              value={janInput}
              onChange={(e) => setJanInput(e.target.value)}
              placeholder="JAN コード"
              className="h-10 min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm dark:bg-[var(--surface-muted)]"
            />
            <button
              type="button"
              onClick={() => void onResolveJan(janInput)}
              disabled={pending}
              className="h-10 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
            >
              JAN で追加
            </button>
            <button
              type="button"
              onClick={() => (scanning ? stopScan() : void startScan())}
              disabled={pending}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)]"
            >
              {scanning ? "スキャン停止" : "カメラスキャン"}
            </button>
          </div>
          <video
            ref={videoRef}
            className={`mt-4 aspect-video w-full max-w-md rounded-lg bg-black object-cover ${
              scanning ? "" : "hidden"
            }`}
            muted
            playsInline
          />
          <div className="mt-6">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SKU・名前で検索…"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm dark:bg-[var(--surface-muted)]"
            />
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => addSku(s, 1)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-muted)]"
                  >
                    <span className="font-mono text-xs text-[var(--foreground)]">
                      {s.sku_code}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {formatYen(s.unit_price_ex_tax)}（税抜）· 在庫 {s.quantity}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              明細
            </h2>
          </div>
          {lines.length === 0 ? (
            <p className="p-5 text-sm text-neutral-500">まだ行がありません。</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {lines.map((l) => (
                <li
                  key={l.sku.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-[var(--foreground)]">
                      {l.sku.sku_code}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {l.sku.name_variant ?? "—"} · 在庫 {l.sku.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--foreground)]"
                      onClick={() => setQty(l.sku.id, l.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-8 text-center tabular-nums">{l.quantity}</span>
                    <button
                      type="button"
                      className="h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--foreground)]"
                      onClick={() => setQty(l.sku.id, l.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm font-medium tabular-nums">
                    {formatYen(
                      lineSubtotalExTax(l.sku.unit_price_ex_tax, l.quantity),
                    )}
                    <span className="ml-1 text-xs font-normal text-neutral-500">
                      税抜
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="sticky top-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card lg:top-24">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            合計（プレビュー）
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            税は {DEFAULT_CONSUMPTION_TAX_RATE * 100}% 固定（`NEXT_PUBLIC_DEFAULT_TAX_RATE` / RPC と同一丸め）。
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500">税抜小計</dt>
              <dd className="font-medium tabular-nums">
                {formatYen(totals.subtotalExTax)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">消費税</dt>
              <dd className="font-medium tabular-nums">
                {formatYen(totals.taxAmount)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-2">
              <dt className="font-semibold text-[var(--foreground)]">
                税込合計
              </dt>
              <dd className="text-lg font-bold tabular-nums text-[var(--foreground)]">
                {formatYen(totals.totalIncTax)}
              </dd>
            </div>
          </dl>
          {message ? (
            <pre className="mt-4 max-h-64 overflow-y-auto rounded-lg bg-amber-50 px-3 py-2 text-left text-xs leading-relaxed text-amber-900 whitespace-pre-wrap break-words font-sans dark:bg-amber-950/40 dark:text-amber-100">
              {message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending || lines.length === 0}
            className="mt-6 w-full rounded-full bg-neutral-900 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {pending ? "確定中…" : "注文を確定"}
          </button>
          <Link
            href="/orders"
            className="mt-3 block text-center text-xs font-semibold text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            一覧へ戻る
          </Link>
        </div>
      </aside>
    </div>
  );
}
