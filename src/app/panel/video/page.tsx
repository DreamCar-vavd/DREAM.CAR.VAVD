import Link from "next/link";
import { notFound } from "next/navigation";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import {
  NotConnectedError,
  StorageAuthError,
  StorageBackendError,
  StorageForbiddenError,
} from "@/lib/content/store/adapter";
import { loadVideoAccess } from "@/lib/media/videoAccessGate";
import { coerceCar } from "@/lib/content/coerce";
import { VideoStoreNotConfiguredError, type VideoObject } from "@/lib/media/videoStore";
import { VideoUploader } from "./VideoUploader";
import { VideoList } from "./VideoList";
import { YoutubeLinkHelper } from "./YoutubeLinkHelper";
import { RefreshButton } from "../PanelActions";

export const dynamic = "force-dynamic";

export default async function VideoPage() {
  if (!keystaticEnabled) notFound();

  // Same server-side gate as /panel and /panel/leads (loadVideoAccess ->
  // assertWriteAccess): a live storage session alone is not evidence the
  // signed-in user still has push access, so this is re-checked live, every
  // request — and getVideoStore() (Blob API, local filesystem) is never
  // called until it has already succeeded (see videoAccessGate.test.ts).
  const gate = await loadVideoAccess();
  if (!gate.ok) {
    const err = gate.error;
    if (err instanceof NotConnectedError || err instanceof StorageAuthError) {
      return (
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-bold">Відео авто</h1>
          <p className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {(err as Error).message}
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- separate app tree */}
          <a className="mt-3 inline-block underline" href="/keystatic">
            Відкрити Keystatic і увійти →
          </a>
        </main>
      );
    }
    if (err instanceof StorageForbiddenError) {
      // Access was refused or revoked — a fresh sign-in will not restore a
      // permission the token never had.
      return (
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-bold">Відео авто</h1>
          <p className="mt-3 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {(err as Error).message}
          </p>
        </main>
      );
    }
    if (err instanceof StorageBackendError && err.retriable) {
      // Unreachable or rate-limited — never claim "no access" for this.
      return (
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-bold">Відео авто</h1>
          <p className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {(err as Error).message}
          </p>
          <p className="mt-3">
            <RefreshButton />
          </p>
        </main>
      );
    }
    throw err;
  }

  const { storage, videoStore: store } = gate;

  let videos: VideoObject[] = [];
  let listError: string | null = null;
  let notConfigured = false;
  try {
    videos = await store.list();
  } catch (err) {
    if (err instanceof VideoStoreNotConfiguredError) {
      notConfigured = true;
      listError = err.message;
    } else {
      listError = (err as Error).message;
    }
  }

  // Which uploaded video does each working car reference? A local key is a bare
  // filename in `/uploads/videos/<key>`; a blob key IS the full https URL, which
  // is what the car's `video.src` stores directly.
  const usage: Record<string, string | null> = Object.fromEntries(videos.map((v) => [v.key, null]));
  try {
    const dir = await storage.readDir("src/content/cms/cars");
    for (const entry of dir.data) {
      const car = coerceCar(entry.name.replace(/\.json$/, ""), JSON.parse(entry.text || "{}"));
      const src = (car.video?.src ?? "").trim();
      if (!src) continue;
      if (src in usage) usage[src] = car.id; // blob: exact URL match
      const m = /\/uploads\/videos\/([^/]+)$/.exec(src); // local: filename
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
        Для відео огляду авто є <strong>два способи</strong>: посилання на YouTube (нижче,
        працює вже зараз, без додаткової оплати) і завантаження власного файлу (окремий розділ,
        додатковий варіант на майбутнє). В обох випадках результат вставляється в поле «Відео»
        авто в Keystatic — саме воно й публікується.
      </p>

      <h2 className="mt-6 text-base font-bold">YouTube — безкоштовний варіант, використовуємо зараз</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Не потребує підключення Vercel Blob і не додає плати за передачу відео через наш сайт —
        файл і трафік обслуговує сам YouTube. Вставте посилання нижче, щоб перевірити його й
        отримати покрокову інструкцію.
      </p>
      <div className="mt-2">
        <YoutubeLinkHelper />
      </div>

      <h2 className="mt-10 text-base font-bold">
        Завантажений відеофайл — додатковий варіант на майбутнє
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Відеофайли зберігаються <strong>поза Git</strong>. Локально —{" "}
        <code>public/uploads/videos/</code> (не потрапляє в репозиторій); на хостингу —
        зовнішнє сховище Vercel Blob (потрібне підключення — docs/PANEL-video-hosting.md, там же
        про приватність чернеток).
      </p>

      {/*
        Exactly one error message on the page, never two: a "not configured"
        listError previously showed here (amber) AND again, byte-identical,
        in the "Завантажені відео" section below (red) — this is the single
        rendering of it, styled by which case it actually is.
      */}
      {listError && (
        <p
          className={
            notConfigured
              ? "mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              : "mt-3 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
          }
        >
          {listError}
          {notConfigured && (
            <>
              {" "}
              Перевірте <code>BLOB_READ_WRITE_TOKEN</code> (Vercel → Storage → Blob).
            </>
          )}
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold">Завантажити відео</h3>
      <div className="mt-2">
        {notConfigured ? (
          <p className="rounded-lg border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
            Завантаження недоступне, доки відеосховище не підключено.
          </p>
        ) : (
          <VideoUploader mode={store.kind} />
        )}
      </div>

      <h3 className="mt-8 text-sm font-semibold">
        Завантажені відео{" "}
        <span className="font-normal text-neutral-500">
          (осиротілі не видаляються автоматично)
        </span>
      </h3>
      {listError ? null : (
        <VideoList videos={videos} usage={usage} />
      )}
    </main>
  );
}
