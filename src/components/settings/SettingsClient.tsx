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
    <div className="mt-8 space-y-8">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          プロフィール
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          表示名はアプリ内の識別に使います（認証メールアドレスは変更しません）。
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              メール
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
              {email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              ロール
            </dt>
            <dd className="mt-0.5 font-mono text-slate-800 dark:text-slate-200">
              {role}
            </dd>
          </div>
        </dl>
        <form onSubmit={onSaveProfile} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="display-name"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              表示名
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              autoComplete="nickname"
              maxLength={120}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
          >
            保存
          </button>
        </form>
        {msg ? (
          <p
            className={[
              "mt-3 text-sm",
              msg.ok
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            ].join(" ")}
            role="status"
          >
            {msg.text}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          データベース
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Supabase への簡易疎通（在庫マスタの参照 1 件）です。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
              dbOk
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200"
                : "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-200",
            ].join(" ")}
          >
            {dbOk ? "接続 OK" : "接続エラー"}
          </span>
          {dbDetail ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {dbDetail}
            </span>
          ) : null}
        </div>
      </section>

      {allowDevSeed ? (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <h2 className="text-base font-semibold text-slate-900 dark:text-amber-100">
            開発用シード
          </h2>
          <p className="mt-1 text-sm text-slate-700 dark:text-amber-100/80">
            <code className="rounded bg-white/60 px-1 py-0.5 text-xs dark:bg-black/30">
              ALLOW_DEV_SEED=true
            </code>{" "}
            のときのみ有効です。デモ用 SKU を CSV 取込 RPC で
            <strong>追記・既存行の上書き</strong>します（全削除はしません）。
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={onSeed}
            className="mt-4 rounded-xl border border-amber-300/90 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50 disabled:opacity-60 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-50 dark:hover:bg-slate-800"
          >
            デモ SKU を取り込む
          </button>
          {seedMsg ? (
            <p
              className={[
                "mt-3 text-sm",
                seedMsg.ok
                  ? "text-emerald-800 dark:text-emerald-300"
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
