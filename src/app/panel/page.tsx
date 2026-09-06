import { notFound } from "next/navigation";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { LOCALES, describeFailure, type ContentLocale } from "@/lib/content/carsGate";
import { getPanelRows, type CarPanelRow } from "@/lib/content/panelStore";
import { PanelButton } from "./PanelActions";

export const dynamic = "force-dynamic";

const LANG_LABEL: Record<ContentLocale, string> = { uk: "UK", en: "EN", ru: "RU" };
const LANG_BADGE = {
  empty: { text: "Не заповнено", cls: "bg-red-100 text-red-800 border-red-300" },
  "needs-review": { text: "Потребує перевірки", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  reviewed: { text: "Перевірено", cls: "bg-green-100 text-green-800 border-green-300" },
} as const;

function PublicState({ row }: { row: CarPanelRow }) {
  if (!row.publishedExists) {
    return <span className="text-neutral-500">Не опубліковане (нова чернетка)</span>;
  }
  const changed = row.publishState === "modified";
  return (
    <span>
      {row.publiclyVisible ? (
        <span className="text-green-700 dark:text-green-400">● На сайті</span>
      ) : (
        <span className="text-neutral-500">
          ○ Опубліковане, приховане (статус «{row.car.saleStatus}»)
        </span>
      )}
      {changed && (
        <span className="ml-2 rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
          є неопубліковані зміни
        </span>
      )}
    </span>
  );
}

export default async function PanelPage() {
  if (!keystaticEnabled) notFound();
  const { rows, publishedAt } = await getPanelRows();
  const isLocalMode = process.env.KEYSTATIC_STORAGE_KIND !== "github";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold">Публікація автомобілів</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Редагування — у{" "}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Keystatic is a separate app tree; needs a full load */}
        <a className="underline" href="/keystatic/collection/cars">
          Keystatic
        </a>
        . Зміни там <strong>не потрапляють на сайт</strong>, поки ви не опублікуєте їх тут.
      </p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Процес: <em>редагувати</em> → <em>позначити кожну мову перевіреною</em> →{" "}
        <em>«Опублікувати зміни»</em>. Знята з публікації або продана картка лишається в панелі.
      </p>

      {!isLocalMode && (
        <p className="mt-3 rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
          Це деплой у GitHub-режимі. Кнопки публікації тут ще не підключені — потрібен GitHub App
          (report/34 §7). Локально (`next dev`) усе працює.
        </p>
      )}

      {publishedAt && (
        <p className="mt-3 text-xs text-neutral-500">
          Остання публікація: {new Date(publishedAt).toLocaleString("uk-UA")}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {rows.length === 0 && <p className="text-sm text-neutral-500">Жодного авто в панелі.</p>}
        {rows.map((row) => (
          <section
            key={row.car.id}
            className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-semibold">{row.car.uk.title || row.car.id}</span>{" "}
                <span className="text-xs text-neutral-500">
                  {row.car.id} · {row.car.price} · порядок {row.car.order}
                </span>
              </div>
              <a
                className="text-xs underline"
                href={`/keystatic/collection/cars/item/${row.car.id}`}
              >
                Редагувати в Keystatic →
              </a>
            </div>

            <div className="mt-2 text-sm">
              <PublicState row={row} />
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              {LOCALES.map((locale) => {
                const status = row.langStatus[locale];
                const badge = LANG_BADGE[status];
                return (
                  <div key={locale} className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-neutral-500">
                      {LANG_LABEL[locale]}
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 text-xs ${badge.cls}`}>
                      {badge.text}
                    </span>
                    {status === "needs-review" && (
                      <PanelButton
                        payload={{ action: "confirm-locale", carId: row.car.id, locale }}
                      >
                        Позначити перевіреним
                      </PanelButton>
                    )}
                  </div>
                );
              })}
            </div>

            {row.blockers.length > 0 && (
              <ul className="mt-3 list-disc space-y-0.5 rounded bg-red-50 p-2 pl-6 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">
                {row.blockers.map((b, i) => (
                  <li key={i}>{describeFailure(b)}</li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <PanelButton
                payload={{ action: "publish", carId: row.car.id }}
                variant="primary"
                disabled={row.blockers.length > 0 || row.publishState === "in-sync"}
              >
                {row.publishedExists ? "Опублікувати зміни" : "Опублікувати"}
              </PanelButton>
              {row.publishedExists && (
                <PanelButton
                  payload={{ action: "unpublish", carId: row.car.id }}
                  variant="danger"
                  confirmText={`Прибрати «${row.car.id}» з сайту? Робоча картка лишиться в панелі.`}
                >
                  Прибрати з сайту
                </PanelButton>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
