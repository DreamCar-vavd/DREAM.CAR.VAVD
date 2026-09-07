"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VideoObject } from "@/lib/media/videoStore";

export function VideoList({
  videos,
  usage,
}: {
  videos: VideoObject[];
  /** key -> car id that references it, if any */
  usage: Record<string, string | null>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function remove(key: string) {
    if (!window.confirm(`Видалити відеофайл «${key}»? Це не можна скасувати.`)) return;
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(`/api/panel/video?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; message?: string };
      setMsg(data.message ?? (data.ok ? "Видалено." : "Помилка."));
      if (data.ok) router.refresh();
    } catch {
      setMsg("Помилка мережі.");
    } finally {
      setBusy(null);
    }
  }

  if (videos.length === 0) {
    return <p className="mt-3 text-sm text-neutral-500">Завантажених відео немає.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {videos.map((v) => {
        const usedBy = usage[v.key];
        return (
          <div
            key={v.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div className="min-w-0">
              <code className="block truncate text-xs">{v.key}</code>
              <span className="text-xs text-neutral-500">
                {(v.size / 1048576).toFixed(1)} МБ ·{" "}
                {usedBy ? (
                  <span className="text-green-700 dark:text-green-400">використовує «{usedBy}»</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">не використовується</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <a href={v.url} target="_blank" rel="noreferrer" className="text-xs underline">
                відкрити
              </a>
              <button
                type="button"
                disabled={busy === v.key || Boolean(usedBy)}
                title={usedBy ? "Спершу від'єднайте відео від авто в Keystatic" : undefined}
                onClick={() => remove(v.key)}
                className="rounded border border-red-500 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950"
              >
                {busy === v.key ? "…" : "Видалити"}
              </button>
            </div>
          </div>
        );
      })}
      {msg && <p className="text-xs text-neutral-500">{msg}</p>}
    </div>
  );
}
