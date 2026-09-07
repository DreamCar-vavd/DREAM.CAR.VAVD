"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "idle" | "creating" | "uploading" | "done" | "error";
const MAX_MB = 200;
const ACCEPT = ["video/mp4", "video/webm"];

export function VideoUploader({ mode }: { mode: "local" | "blob" }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    setError(null);
    setResult(null);
    setPhase("idle");
    if (!f) return setFile(null);
    if (!ACCEPT.includes(f.type)) {
      setFile(null);
      return setError(`Непідтримуваний тип «${f.type || "?"}». Дозволено MP4, WebM.`);
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      return setError(`Завеликий файл (${(f.size / 1048576).toFixed(0)} МБ > ${MAX_MB} МБ).`);
    }
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setError(null);
    setPhase("creating");
    setProgress(0);
    try {
      if (mode === "blob") {
        await uploadToBlob(file);
        return;
      }
      await uploadLocal(file);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "__aborted__" || /abort/i.test(msg)) {
        setPhase("idle");
        setProgress(0);
        setError("Завантаження скасовано.");
        return;
      }
      setPhase("error");
      setError(msg);
    }
  }

  /** Vercel Blob: browser streams straight to storage after a token exchange. */
  async function uploadToBlob(f: File) {
    const { upload } = await import("@vercel/blob/client");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase("uploading");
    const blob = await upload(`panel/videos/${f.name}`, f, {
      access: "public",
      handleUploadUrl: "/api/panel/video",
      contentType: f.type,
      abortSignal: ctrl.signal,
      onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
    });
    abortRef.current = null;
    setResult({ url: blob.url, size: f.size });
    setPhase("done");
    router.refresh();
  }

  /** Local dev: PUT the bytes through the route (no size cap under next dev). */
  async function uploadLocal(file: File) {
    const res = await fetch("/api/panel/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      message?: string;
      uploadUrl?: string;
      publicUrl?: string;
    };
    if (!data.ok || !data.uploadUrl || !data.publicUrl) {
      throw new Error(data.message ?? "Не вдалося створити завантаження.");
    }

    setPhase("uploading");
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", data.uploadUrl!);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let m = `Помилка ${xhr.status}`;
          try {
            m = JSON.parse(xhr.responseText).message ?? m;
          } catch {}
          reject(new Error(m));
        }
      };
      xhr.onerror = () => {
        xhrRef.current = null;
        reject(new Error("Мережева помилка під час завантаження."));
      };
      xhr.onabort = () => {
        xhrRef.current = null;
        reject(new Error("__aborted__"));
      };
      xhr.send(file);
    });

    setResult({ url: data.publicUrl, size: file.size });
    setPhase("done");
    router.refresh();
  }

  function cancel() {
    xhrRef.current?.abort();
    abortRef.current?.abort();
  }

  const busy = phase === "creating" || phase === "uploading";

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        disabled={busy}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded file:border file:border-neutral-400 file:bg-neutral-50 file:px-3 file:py-1.5 file:text-sm dark:file:bg-neutral-800"
      />

      {file && phase !== "done" && (
        <p className="mt-2 text-xs text-neutral-500">
          {file.name} · {(file.size / 1048576).toFixed(1)} МБ
        </p>
      )}

      {busy && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
            <div className="h-full bg-amber-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
            <span>{phase === "creating" ? "Підготовка…" : `${progress}%`}</span>
            <button type="button" onClick={cancel} className="underline">
              Скасувати
            </button>
          </div>
        </div>
      )}

      {!busy && phase !== "done" && (
        <button
          type="button"
          onClick={upload}
          disabled={!file}
          className="mt-3 rounded border border-amber-600 bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-40"
        >
          Завантажити
        </button>
      )}

      {error && (
        <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
          {phase === "error" && (
            <button type="button" onClick={upload} className="ml-2 underline">
              Спробувати ще раз
            </button>
          )}
        </p>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-green-700 dark:text-green-400">
            ✓ Завантажено ({(result.size / 1048576).toFixed(1)} МБ). Тепер прикріпіть посилання до
            авто:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-neutral-600 dark:text-neutral-400">
            <li>
              Скопіюйте посилання:{" "}
              <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{result.url}</code>{" "}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(result.url);
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
              <strong>«Завантажене відео»</strong>.
            </li>
            <li>
              Вставте посилання в поле «Шлях / посилання на відео»; у «Постер відео» — шлях до
              головного фото авто.
            </li>
            <li>Save у Keystatic → у /panel позначте авто перевіреним і опублікуйте.</li>
          </ol>
          <video
            src={result.url}
            controls
            preload="metadata"
            className="mt-2 max-h-64 w-full rounded border border-border-gold/40 bg-black"
          />
        </div>
      )}
    </div>
  );
}
