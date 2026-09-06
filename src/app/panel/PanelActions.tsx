"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Action =
  | { action: "confirm-locale"; carId: string; locale: string }
  | { action: "publish"; carId: string }
  | { action: "unpublish"; carId: string };

export function PanelButton({
  payload,
  children,
  disabled,
  variant = "default",
  confirmText,
}: {
  payload: Action;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  confirmText?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message: string;
        blockers?: { kind: string }[];
      };
      const extra = data.blockers?.length ? ` (${data.blockers.length} пункт(и))` : "";
      setMsg({ ok: data.ok, text: data.message + extra });
      if (data.ok) startTransition(() => router.refresh());
    } catch {
      setMsg({ ok: false, text: "Помилка мережі. Спробуйте ще раз." });
    } finally {
      setBusy(false);
    }
  }

  const base =
    "inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
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
        <span className={`text-xs ${msg.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
          {msg.text}
        </span>
      )}
    </span>
  );
}
