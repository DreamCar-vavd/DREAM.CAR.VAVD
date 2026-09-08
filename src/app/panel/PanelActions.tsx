"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface PanelVersions {
  car: string;
  gallery: string;
  service: string;
  contact: string;
  promo: string;
  review: string;
  published: string;
}

type ActionPayload =
  | { action: "confirm-locale"; kind: string; id: string; locale: string }
  | { action: "publish"; kind: string; id: string }
  | { action: "unpublish"; kind: string; id: string };

export function PanelButton({
  payload,
  versions,
  children,
  disabled,
  variant = "default",
  confirmText,
}: {
  payload: ActionPayload;
  versions: PanelVersions;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  confirmText?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "conflict"; text: string } | null>(null);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, versions }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message: string;
        conflict?: boolean;
        transient?: boolean;
        blockers?: { kind: string }[];
      };
      const extra = data.blockers?.length ? ` (${data.blockers.length} пункт(и))` : "";
      // A conflict or a transient backend failure both mean "reload and check
      // before acting again" — same amber treatment + refresh affordance.
      setMsg({
        kind: data.ok ? "ok" : data.conflict || data.transient ? "conflict" : "err",
        text: data.message + extra,
      });
      if (data.ok) startTransition(() => router.refresh());
    } catch {
      setMsg({
        kind: "conflict",
        text: "Помилка мережі — відповідь не отримано. Дію могло бути застосовано або ні; оновіть сторінку й перевірте стан перш ніж повторювати.",
      });
    } finally {
      setBusy(false);
    }
  }

  const base =
    "inline-flex min-h-[36px] items-center gap-1 rounded border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    default: "border-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800",
    primary: "border-amber-600 bg-amber-600 text-white hover:bg-amber-700",
    danger: "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950",
  }[variant];

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={disabled || busy || pending}
        className={`${base} ${styles}`}
      >
        {busy || pending ? "…" : children}
      </button>
      {msg && (
        <span
          className={`text-xs ${
            msg.kind === "ok"
              ? "text-green-700 dark:text-green-400"
              : msg.kind === "conflict"
                ? "text-amber-700 dark:text-amber-400"
                : "text-red-600"
          }`}
        >
          {msg.text}
          {msg.kind === "conflict" && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => startTransition(() => router.refresh())}
            >
              Оновити
            </button>
          )}
        </span>
      )}
    </span>
  );
}

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="inline-flex min-h-[36px] items-center rounded border border-neutral-400 px-3 py-1.5 text-xs hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
    >
      {pending ? "…" : "Оновити стан"}
    </button>
  );
}
