import { notFound } from "next/navigation";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { LOCALES, describeFailure, type ContentLocale } from "@/lib/content/carsGate";
import { getStorage, NotConnectedError, type DeployStatus } from "@/lib/content/store";
import { getPanelData, type CarPanelRow, type PanelData } from "@/lib/content/panelStore";
import { PanelButton, RefreshButton } from "./PanelActions";

export const dynamic = "force-dynamic";

const LANG_LABEL: Record<ContentLocale, string> = { uk: "UK", en: "EN", ru: "RU" };
const LANG_BADGE = {
  empty: { text: "Не заповнено", cls: "bg-red-100 text-red-800 border-red-300" },
  "needs-review": { text: "Потребує перевірки", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  reviewed: { text: "Перевірено", cls: "bg-green-100 text-green-800 border-green-300" },
} as const;

function DeployBanner({ deploy, mode }: { deploy: DeployStatus; mode: "local" | "github" }) {
  if (mode === "local") {
    return (
      <p className="mt-2 text-xs text-neutral-500">
        Локальний режим: зміни у файлах одразу, кроку збірки немає.
      </p>
    );
  }
  const map: Record<DeployStatus["state"], { text: string; cls: string }> = {
    "n/a": { text: "", cls: "" },
    none: { text: "Деплой для поточного знімка не знайдено.", cls: "text-neutral-500" },
    pending: { text: "⏳ Збірка виконується — зміни ще не в ефірі.", cls: "text-amber-700" },
    ready: { text: "✅ Поточний знімок в ефірі.", cls: "text-green-700 dark:text-green-400" },
    error: { text: "⚠️ Збірка не вдалася — в ефірі лишається попередня версія.", cls: "text-red-600" },
  };
  const s = map[deploy.state];
  return (
    <p className={`mt-2 flex items-center gap-2 text-xs ${s.cls}`}>
      <span>{s.text}</span>
      {"url" in deploy && deploy.url && (
        <a className="underline" href={deploy.url} target="_blank" rel="noreferrer">
          відкрити
        </a>
      )}
      <RefreshButton />
    </p>
  );
}

function PublicState({ row }: { row: CarPanelRow }) {
  if (!row.publishedExists) {
    return <span className="text-neutral-500">Не опубліковане (нова чернетка)</span>;
  }
  return (
    <span>
      {row.publiclyVisible ? (
        <span className="text-green-700 dark:text-green-400">● На сайті</span>
      ) : (
        <span className="text-neutral-500">
          ○ Опубліковане, приховане (статус «{row.car.saleStatus}»)
        </span>
      )}
      {row.publishState === "modified" && (
        <span className="ml-2 rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
          є неопубліковані зміни
        </span>
      )}
    </span>
  );
}

function CarRow({ row, versions }: { row: CarPanelRow; versions: PanelData["versions"] }) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-semibold">{row.car.uk.title || row.car.id}</span>{" "}
          <span className="text-xs text-neutral-500">
            {row.car.id} · {row.car.price} · порядок {row.car.order}
          </span>
        </div>
        <a className="text-xs underline" href={`/keystatic/collection/cars/item/${row.car.id}`}>
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
              <span className="text-xs font-semibold text-neutral-500">{LANG_LABEL[locale]}</span>
              <span className={`rounded border px-1.5 py-0.5 text-xs ${badge.cls}`}>
                {badge.text}
              </span>
              {status === "needs-review" && (
                <PanelButton
                  payload={{ action: "confirm-locale", carId: row.car.id, locale }}
                  versions={versions}
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
          versions={versions}
          variant="primary"
          disabled={row.blockers.length > 0 || row.publishState === "in-sync"}
        >
          {row.publishedExists ? "Опублікувати зміни" : "Опублікувати"}
        </PanelButton>
        {row.publishedExists && (
          <PanelButton
            payload={{ action: "unpublish", carId: row.car.id }}
            versions={versions}
            variant="danger"
            confirmText={`Прибрати «${row.car.id}» з сайту? Робоча картка лишиться в панелі.`}
          >
            Прибрати з сайту
          </PanelButton>
        )}
      </div>
    </section>
  );
}

export default async function PanelPage() {
  if (!keystaticEnabled) notFound();

  let data: PanelData;
  try {
    data = await getPanelData(await getStorage());
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return (
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-bold">Публікація автомобілів</h1>
          <p className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            {err.message}
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- separate app tree */}
          <a className="mt-3 inline-block underline" href="/keystatic">
            Відкрити Keystatic і увійти →
          </a>
        </main>
      );
    }
    throw err;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold">Публікація автомобілів</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Редагування — у{" "}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- separate app tree */}
        <a className="underline" href="/keystatic/collection/cars">
          Keystatic
        </a>
        . Зміни там <strong>не потрапляють на сайт</strong>, поки ви не опублікуєте їх тут.
      </p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Процес: <em>редагувати</em> → <em>позначити кожну мову перевіреною</em> →{" "}
        <em>«Опублікувати зміни»</em> → дочекатися завершення збірки.
      </p>

      <DeployBanner deploy={data.deploy} mode={data.mode} />
      {data.publishedAt && (
        <p className="mt-1 text-xs text-neutral-500">
          Остання публікація: {new Date(data.publishedAt).toLocaleString("uk-UA")}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {data.rows.length === 0 && <p className="text-sm text-neutral-500">Жодного авто в панелі.</p>}
        {data.rows.map((row) => (
          <CarRow key={row.car.id} row={row} versions={data.versions} />
        ))}
      </div>
    </main>
  );
}
