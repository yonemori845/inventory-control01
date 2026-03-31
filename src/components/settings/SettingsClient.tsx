"use client";

import {
  seedDevDataAction,
  updateDisplayNameAction,
  type ActionResult,
} from "@/app/actions/settings";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  email: string;
  initialDisplayName: string | null;
  role: string;
  dbOk: boolean;
  dbDetail: string | null;
  allowDevSeed: boolean;
};

function flashMessage(r: ActionResult): { text: string; ok: boolean } {
  if (!r.ok) return { text: r.message, ok: false };
  return { text: r.message ?? "保存しました。", ok: true };
}

export function SettingsClient({
  email,
  initialDisplayName,
  role,
  dbOk,
  dbDetail,
  allowDevSeed,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialDisplayName ?? "");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [seedMsg, setSeedMsg] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const onSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const r = await updateDisplayNameAction(name);
      setMsg(flashMessage(r));
      if (r.ok) router.refresh();
    });
  };

  const onSeed = () => {
    setSeedMsg(null);
    startTransition(async () => {
      const r = await seedDevDataAction();
      setSeedMsg(flashMessage(r));
      if (r.ok) router.refresh();
    });
  };

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card sm:p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          プロフィール
        </h2>
        <p className="mt-1 text-sm leading-snug text-neutral-600 dark:text-neutral-400">
          表示名はアプリ内の識別に使います（認証メールアドレスは変更しません）。
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              メール
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--foreground)]">
              {email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              ロール
            </dt>
            <dd className="mt-0.5 font-mono text-neutral-800 dark:text-neutral-200">
              {role}
            </dd>
          </div>
        </dl>
        <form onSubmit={onSaveProfile} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="display-name"
              className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
            >
              表示名
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none transition focus:border-[var(--border-strong)] focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/10 dark:bg-[var(--surface-muted)]"
              autoComplete="nickname"
              maxLength={120}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary shrink-0"
          >
            保存
          </button>
        </form>
        {msg ? (
          <p
            className={[
              "mt-3 text-sm",
              msg.ok
                ? "text-neutral-700 dark:text-neutral-300"
                : "text-red-600 dark:text-red-400",
            ].join(" ")}
            role="status"
          >
            {msg.text}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card sm:p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          データベース
        </h2>
        <p className="mt-1 text-sm leading-snug text-neutral-600 dark:text-neutral-400">
          Supabase への簡易疎通（在庫マスタの参照 1 件）です。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
              dbOk
                ? "bg-[var(--surface-muted)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
                : "bg-red-50 text-red-900 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/50",
            ].join(" ")}
          >
            {dbOk ? "接続 OK" : "接続エラー"}
          </span>
          {dbDetail ? (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {dbDetail}
            </span>
          ) : null}
        </div>
      </section>

      {allowDevSeed ? (
        <section className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-muted)] p-4 shadow-card sm:p-5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            開発用シード
          </h2>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            <code className="rounded bg-[var(--surface)] px-1 py-0.5 text-xs ring-1 ring-[var(--border)]">
              ALLOW_DEV_SEED=true
            </code>{" "}
            のときのみ有効です。デモ用 SKU を CSV 取込 RPC で
            <strong>追記・既存行の上書き</strong>します（全削除はしません）。
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={onSeed}
            className="btn btn-foreground mt-4 font-semibold disabled:opacity-60"
          >
            デモ SKU を取り込む
          </button>
          {seedMsg ? (
            <p
              className={[
                "mt-3 text-sm",
                seedMsg.ok
                  ? "text-neutral-800 dark:text-neutral-200"
                  : "text-red-700 dark:text-red-300",
              ].join(" ")}
              role="status"
            >
              {seedMsg.text}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
