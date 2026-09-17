"use client";

import { useState } from "react";
import { parseYoutubeUrl } from "@/lib/media/youtube";

/**
 * Convenience + validation only — this never writes to any car. It mirrors
 * VideoUploader's existing pattern: show the owner something copyable, plus
 * the exact Keystatic steps to attach it. The ORIGINAL pasted URL is what
 * gets copied and pasted into Keystatic's "Зовнішнє посилання" field —
 * never the normalized embed URL — the site itself re-derives a safe embed
 * address from it at render time (src/lib/content/carVideo.ts), the same
 * function this preview uses to build the iframe below.
 */
export function YoutubeLinkHelper() {
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);

  const trimmed = value.trim();
  const parsed = trimmed ? parseYoutubeUrl(trimmed) : null;

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <label htmlFor="youtube-url" className="block text-sm font-medium">
        Посилання на YouTube-відео
      </label>
      <input
        id="youtube-url"
        type="url"
        inputMode="url"
        placeholder="https://www.youtube.com/watch?v=..."
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCopied(false);
        }}
        className="mt-2 block w-full rounded border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
      />

      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Підходить <strong>Public</strong> або <strong>Unlisted</strong>. «Unlisted» —{" "}
        <strong>не приватне</strong>: відео відкриється кожному, хто має посилання, YouTube лише
        не показує його в пошуку й на каналі.
      </p>

      {trimmed && parsed && !parsed.ok && (
        <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">
          Не схоже на коректне посилання YouTube: {parsed.reason}. Підтримуються посилання виду{" "}
          <code className="rounded bg-red-100 px-1 dark:bg-red-900">youtube.com/watch?v=…</code>,{" "}
          <code className="rounded bg-red-100 px-1 dark:bg-red-900">youtu.be/…</code>,{" "}
          <code className="rounded bg-red-100 px-1 dark:bg-red-900">youtube.com/shorts/…</code>.
        </p>
      )}

      {parsed?.ok && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-green-700 dark:text-green-400">✓ Посилання коректне.</p>
          <iframe
            src={parsed.embedUrl}
            title="Попередній перегляд YouTube-відео"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            className="aspect-video w-full max-w-md rounded border border-border-gold/40"
          />
          <ol className="list-decimal space-y-1 pl-5 text-xs text-neutral-600 dark:text-neutral-400">
            <li>
              Скопіюйте саме це посилання (не потрібно нічого нормалізувати):{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{trimmed}</code>{" "}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(trimmed);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="underline"
              >
                {copied ? "скопійовано" : "копіювати"}
              </button>
            </li>
            <li>
              Keystatic → потрібне авто → блок «Відео» → «Відео огляду» ={" "}
              <strong>«Зовнішнє посилання»</strong>.
            </li>
            <li>
              Вставте скопійоване посилання в поле «Шлях / посилання на відео»; у «Постер відео»
              — шлях до головного фото авто.
            </li>
            <li>Save у Keystatic → у /panel позначте авто перевіреним і опублікуйте.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
