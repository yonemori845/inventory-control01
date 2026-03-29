import {
  formatYen,
  priceIncTax,
} from "@/lib/pricing";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SkuDetailQuantityForm } from "./SkuDetailQuantityForm";

type GroupEmbed = {
  id: string;
  group_code: string;
  name: string;
};

export type SkuDetailRow = {
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
  image_path: string | null;
  product_groups: GroupEmbed | GroupEmbed[] | null;
};

function resolveSkuImagePublicUrl(
  imagePath: string | null | undefined,
): string | null {
  const raw = imagePath?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  const path = raw.replace(/^\//, "");
  return `${base}/storage/v1/object/public/${path}`;
}

function groupOf(row: SkuDetailRow): GroupEmbed | null {
  const g = row.product_groups;
  if (!g) return null;
  return Array.isArray(g) ? (g[0] ?? null) : g;
}

export function SkuDetailView({
  row,
  lastInboundAt,
  alert,
  rec,
}: {
  row: SkuDetailRow;
  lastInboundAt: string | null;
  alert: boolean;
  rec: number;
}) {
  const group = groupOf(row);
  const imageUrl = resolveSkuImagePublicUrl(row.image_path);
  const ex = Number(row.unit_price_ex_tax);
  const exSafe = Number.isFinite(ex) ? ex : 0;
  const inc = priceIncTax(exSafe);
  const productTitle = group?.name ?? row.sku_code;
  const subtitleParts = [row.name_variant, row.color].filter(Boolean);
  const lastInboundLabel = lastInboundAt
    ? new Date(lastInboundAt).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      })
    : "—";
  const stockStatus =
    row.quantity <= 0
      ? {
          label: "在庫切れ",
          className:
            "bg-[var(--surface-muted)] text-[var(--foreground)] ring-1 ring-[var(--border)]",
        }
      : alert
        ? {
            label: "要補充",
            className:
              "bg-[var(--surface-muted)] text-[var(--foreground)] ring-1 ring-[var(--border-strong)]",
          }
        : {
            label: "在庫あり",
            className:
              "bg-[var(--surface-muted)] text-neutral-600 ring-1 ring-[var(--border)] dark:text-neutral-300",
          };

  return (
    <div className="min-h-0">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 flex items-start gap-3">
          <Link
            href="/inventory"
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-neutral-600 shadow-sm transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)] dark:text-neutral-300"
            aria-label="在庫一覧へ戻る"
          >
            <IconArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Inventory
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              商品詳細
            </h1>
            <p className="mt-1 text-sm leading-snug text-neutral-500">
              商品情報と在庫
            </p>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          {alert ? (
            <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 sm:px-6">
              <p className="text-sm font-medium text-[var(--foreground)]">
                在庫アラート（発注点または安全在庫を下回っています）
                {rec > 0 ? ` · 推奨発注 ${rec}` : ""}
              </p>
            </div>
          ) : null}

          <div className="grid gap-6 p-5 sm:gap-8 sm:p-6 lg:grid-cols-12 lg:gap-8">
            <section className="lg:col-span-5">
              <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">
                商品画像
              </h2>
              <div className="overflow-hidden rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)]">
                {imageUrl ? (
                  <div className="relative aspect-square w-full bg-[var(--surface-muted)]">
                    <Image
                      src={imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 384px"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                    <span className="text-sm font-medium text-neutral-500">
                      画像が未設定です
                    </span>
                    <span className="text-xs text-neutral-400">
                      Storage に配置し{" "}
                      <code className="rounded bg-[var(--surface-muted)] px-1 font-mono text-[10px] ring-1 ring-[var(--border)]">
                        image_path
                      </code>{" "}
                      にパスを保存してください
                    </span>
                  </div>
                )}
              </div>
              <SkuImageChangeButton />
              <p className="mt-3 text-center text-[11px] leading-relaxed text-neutral-400">
                対応形式: JPEG、PNG、WebP（最大 5MB）
                <br />
                <span className="text-neutral-400">
                  ※ アップロード UI は Storage 連携後に有効化予定です
                </span>
              </p>
            </section>

            <div className="space-y-4 lg:col-span-7">
              <FieldBlock label="商品名">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)]">
                  <span className="font-medium">{productTitle}</span>
                  {!row.is_active ? (
                    <span className="ml-2 rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-normal text-neutral-600 ring-1 ring-[var(--border)]">
                      無効 SKU
                    </span>
                  ) : null}
                  {subtitleParts.length ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      {subtitleParts.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </FieldBlock>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldBlock label="サイズ">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)]">
                    {row.size?.trim() || "—"}
                  </div>
                </FieldBlock>
                <FieldBlock label="商品コード">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 font-mono text-sm text-[var(--foreground)]">
                    {group?.group_code ?? "—"}
                  </div>
                </FieldBlock>
              </div>
              <FieldBlock label="JAN コード">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 font-mono text-sm text-[var(--foreground)]">
                  {row.jan_code}
                </div>
              </FieldBlock>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldBlock label="税抜価格">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm font-medium tabular-nums text-[var(--foreground)]">
                    {formatYen(Math.round(exSafe))}
                  </div>
                </FieldBlock>
                <FieldBlock label="税込価格">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm font-medium tabular-nums text-[var(--foreground)]">
                    {formatYen(inc)}
                  </div>
                </FieldBlock>
              </div>
              <p className="text-[11px] text-neutral-400">
                SKU:{" "}
                <span className="font-mono text-neutral-500">
                  {row.sku_code}
                </span>
                {" · "}
                発注点 {row.reorder_point} / 安全在庫 {row.safety_stock}
              </p>

              <div className="border-t border-[var(--border)] pt-4" />

              <FieldBlock label="在庫数量">
                <SkuDetailQuantityForm
                  skuId={row.id}
                  initialQuantity={row.quantity}
                />
              </FieldBlock>
              <FieldBlock label="最終入庫日">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)]">
                  {lastInboundLabel}
                  {lastInboundAt ? (
                    <span className="ml-2 text-xs text-neutral-400">
                      （在庫が増加した直近の履歴）
                    </span>
                  ) : null}
                </div>
              </FieldBlock>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  在庫ステータス
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${stockStatus.className}`}
                >
                  {stockStatus.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-neutral-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function SkuImageChangeButton() {
  return (
    <button
      type="button"
      disabled
      title="Storage 連携後に利用可能になる予定です"
      className="mt-4 flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 text-sm font-semibold text-neutral-600 shadow-sm opacity-60 dark:text-neutral-300"
    >
      画像を変更
    </button>
  );
}

function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
