import Link from "next/link";
import { notFound } from "next/navigation";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { getStorage, NotConnectedError } from "@/lib/content/store";
import { coerceCar } from "@/lib/content/coerce";
import { getVideoStore, VideoStoreNotConfiguredError, type VideoObject } from "@/lib/media/videoStore";
import { VideoUploader } from "./VideoUploader";
import { VideoList } from "./VideoList";

export const dynamic = "force-dynamic";

export default async function VideoPage() {
  if (!keystaticEnabled) notFound();

  let storage;
  try {
    storage = await getStorage();
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return (
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-bold">Відео авто</h1>
          <p className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            {err.message}
          </p>
        </main>
      );
    }
    throw err;
  }

  const store = getVideoStore();

  let videos: VideoObject[] = [];
  let listError: string | null = null;
  try {
    videos = await store.list();
  } catch (err) {
    listError =
      err instanceof VideoStoreNotConfiguredError ? err.message : (err as Error).message;
  }

  // Which uploaded video does each working car reference?
  const usage: Record<string, string | null> = Object.fromEntries(videos.map((v) => [v.key, null]));
  try {
    const dir = await storage.readDir("src/content/cms/cars");
    for (const entry of dir.data) {
      const car = coerceCar(entry.name.replace(/\.json$/, ""), JSON.parse(entry.text || "{}"));
      const src = car.video?.src ?? "";
      const m = /\/uploads\/videos\/([^/]+)$/.exec(src);
      if (m && m[1] in usage) usage[m[1]] = car.id;
    }
  } catch {
    /* usage is best-effort */
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Відео авто</h1>
        <Link className="inline-block py-1 text-xs underline" href="/panel">
          ← до публікації
        </Link>
      </div>

      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Відеофайли зберігаються <strong>поза Git</strong>. Локально —{" "}
        <code>public/uploads/videos/</code> (не потрапляє в репозиторій); на хостингу —
        зовнішнє сховище (потрібне підключення, див. звіт). Після завантаження посилання
        вставляється в поле «Відео» авто в Keystatic — саме воно й публікується.
      </p>

      {store.kind === "blob" && (
        <p className="mt-3 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          Хостинг-режим: адаптер зовнішнього сховища ще не реалізований. Завантаження відео
          доступне лише локально (<code>next dev</code>).
        </p>
      )}

      <h2 className="mt-6 text-sm font-semibold">Завантажити відео</h2>
      <div className="mt-2">
        <VideoUploader />
      </div>

      <h2 className="mt-8 text-sm font-semibold">
        Завантажені відео{" "}
        <span className="font-normal text-neutral-500">
          (осиротілі не видаляються автоматично)
        </span>
      </h2>
      {listError ? (
        <p className="mt-2 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          {listError}
        </p>
      ) : (
        <VideoList videos={videos} usage={usage} />
      )}
    </main>
  );
}
