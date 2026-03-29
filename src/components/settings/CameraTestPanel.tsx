"use client";

import {
  explainGetUserMediaFailure,
  getCameraPrerequisiteMessage,
} from "@/lib/media/camera-access-help";
import { getScanCameraStream } from "@/lib/media/scan-camera";
import { useCallback, useEffect, useState } from "react";

export function CameraTestPanel() {
  const [status, setStatus] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  /** サーバーと初回クライアント描画を一致させる（マウント後のみ window を参照） */
  const [browserInfo, setBrowserInfo] = useState<{
    origin: string;
    secure: boolean;
  } | null>(null);

  useEffect(() => {
    setBrowserInfo({
      origin: window.location.origin,
      secure: window.isSecureContext,
    });
  }, []);

  const runTest = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    setOk(null);
    const pre = getCameraPrerequisiteMessage();
    if (pre) {
      setOk(false);
      setStatus(pre);
      setBusy(false);
      return;
    }
    try {
      const stream = await getScanCameraStream();
      stream.getTracks().forEach((t) => t.stop());
      setOk(true);
      setStatus(
        "カメラストリームを取得できました。在庫・注文画面のスキャンでも同じ条件で動くはずです。",
      );
    } catch (e) {
      setOk(false);
      setStatus(explainGetUserMediaFailure(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card sm:p-5">
      <h2 className="text-base font-semibold text-[var(--foreground)]">
        カメラ（ブラウザ）の確認
      </h2>
      <p className="mt-1 text-sm leading-snug text-neutral-600 dark:text-neutral-400">
        Zoom など<strong>アプリ</strong>のカメラとは別経路です。ここで失敗する場合は、下の「Windows
        / Chrome での確認」を試してください。
      </p>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="text-neutral-500">いま開いている元（origin）</p>
          <p className="mt-0.5 font-mono text-xs text-neutral-800 dark:text-neutral-200">
            {browserInfo?.origin ?? "…"}
          </p>
        </div>
        <div>
          <p className="text-neutral-500">セキュアコンテキスト</p>
          <p className="mt-0.5">
            {browserInfo ? (
              <span
                className={
                  browserInfo.secure
                    ? "font-semibold text-neutral-800 dark:text-neutral-200"
                    : "font-semibold text-red-600 dark:text-red-400"
                }
              >
                {browserInfo.secure
                  ? "はい（カメラ利用の前提を満たしやすい）"
                  : "いいえ（カメラがブロックされやすい）"}
              </span>
            ) : (
              <span className="text-neutral-400">…</span>
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void runTest()}
        className="mt-4 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {busy ? "テスト中…" : "カメラをテスト（取得してすぐ停止）"}
      </button>

      {status ? (
        <pre
          className={[
            "mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-xs leading-relaxed font-sans",
            ok === true
              ? "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]"
              : "border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100",
          ].join(" ")}
          role="status"
        >
          {status}
        </pre>
      ) : null}

      <div className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-neutral-600 dark:text-neutral-400">
        <h3 className="font-semibold text-[var(--foreground)]">
          Windows / Chrome での確認（Zoom と別）
        </h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            <strong>設定 → プライバシーとセキュリティ → カメラ</strong>
            で「カメラへのアクセス」がオンか確認。「アプリがカメラにアクセスできるようにする」がオフだとブラウザも使えません。
          </li>
          <li>
            <strong>Chrome</strong>: アドレスバーに{" "}
            <code className="rounded bg-[var(--surface-muted)] px-1 text-xs ring-1 ring-[var(--border)]">
              chrome://settings/content/camera
            </code>{" "}
            を開き、一覧に <strong>localhost:3000</strong>（またはお使いのポート）が「ブロック」になっていないか確認。ブロックなら削除するか「許可」に変更。
          </li>
          <li>
            同じ画面で <strong>「カメラを使用できるサイトを確認」</strong>{" "}
            から、このアプリの URL を探して許可にする。
          </li>
          <li>
            企業PCの場合は、<strong>ポリシーでブラウザのカメラだけ禁止</strong>
            されていることがあります（Zoom はネイティブのため通る）。情報システムに確認。
          </li>
        </ol>
      </div>
    </section>
  );
}
