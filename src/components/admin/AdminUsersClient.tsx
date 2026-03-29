"use client";

import { updateProfileRoleAction } from "@/app/actions/admin";
import type { AppRole } from "@/lib/admin-roles";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string;
  created_at: string;
};

type Props = {
  profiles: ProfileRow[];
  currentUserId: string;
  isAdmin: boolean;
};

export function AdminUsersClient({
  profiles,
  currentUserId,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const onRoleChange = (targetId: string, role: AppRole) => {
    setMsg(null);
    startTransition(async () => {
      const r = await updateProfileRoleAction(targetId, role);
      if (!r.ok) {
        setMsg({ text: r.message, ok: false });
        router.refresh();
        return;
      }
      setMsg({ text: "ロールを更新しました。", ok: true });
      router.refresh();
    });
  };

  return (
    <div className="mt-6">
      {!isAdmin ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--foreground)]">
          ロールの変更は <strong>admin</strong> のユーザーのみ可能です。一覧は参照のみです。
        </p>
      ) : null}

      {msg ? (
        <p
          className={[
            "mb-4 text-sm",
            msg.ok
              ? "text-neutral-700 dark:text-neutral-300"
              : "text-red-600 dark:text-red-400",
          ].join(" ")}
          role="status"
        >
          {msg.text}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            <tr>
              <th className="px-4 py-3">表示名</th>
              <th className="px-4 py-3">ユーザー ID</th>
              <th className="px-4 py-3">ロール</th>
              <th className="hidden px-4 py-3 sm:table-cell">登録</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {profiles.map((p) => (
              <tr
                key={p.id}
                className={
                  p.id === currentUserId
                    ? "bg-[var(--surface-muted)]"
                    : ""
                }
              >
                <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                  {p.display_name?.trim() || "—"}
                  {p.id === currentUserId ? (
                    <span className="ml-2 text-xs font-normal text-neutral-500">
                      （あなた）
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                  {p.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <select
                      aria-label={`${p.id} のロール`}
                      className="w-full max-w-[10rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm dark:bg-[var(--surface-muted)]"
                      value={p.role === "user" ? "user" : "admin"}
                      disabled={pending}
                      onChange={(e) =>
                        onRoleChange(p.id, e.target.value as AppRole)
                      }
                    >
                      <option value="admin">admin</option>
                      <option value="user">user</option>
                    </select>
                  ) : (
                    <span className="font-mono text-neutral-800 dark:text-neutral-200">
                      {p.role}
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-neutral-500 dark:text-neutral-400 sm:table-cell">
                  {p.created_at.slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
