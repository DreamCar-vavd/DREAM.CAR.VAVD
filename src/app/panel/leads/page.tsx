import Link from "next/link";
import { notFound } from "next/navigation";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { getStorage, NotConnectedError } from "@/lib/content/store";
import { getLeadsStore, LeadsNotConfiguredError, type Lead } from "@/lib/leads/store";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" });
}

function DemoBanner() {
  return (
    <p className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <strong>Демонстраційні дані.</strong> Базу заявок ще не підключено — цей список
      згенеровано на сервері для перевірки інтерфейсу. Це <strong>не</strong> справжні
      звернення клієнтів. Справжні заявки й далі надходять на пошту через наявний
      канал (він тут не змінюється).
    </p>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  return (
    <details className="rounded border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
        <span>
          <span className="font-semibold">{lead.name || "—"}</span>{" "}
          <span className="text-neutral-500">· {lead.service || "—"}</span>
        </span>
        <span className="text-xs text-neutral-500">{fmtDate(lead.createdAt)}</span>
      </summary>
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        <dt className="text-neutral-500">Телефон</dt>
        <dd>{lead.phone || "—"}</dd>
        <dt className="text-neutral-500">Email</dt>
        <dd>{lead.email || "—"}</dd>
        <dt className="text-neutral-500">Послуга</dt>
        <dd>{lead.service || "—"}</dd>
        <dt className="text-neutral-500">Авто</dt>
        <dd>{lead.vehicle || "—"}</dd>
        <dt className="text-neutral-500">Повідомлення</dt>
        <dd className="whitespace-pre-line">{lead.message || "—"}</dd>
      </dl>
    </details>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  if (!keystaticEnabled) notFound();

  // Same server-side gate as the publish dashboard: a live storage session is
  // required (local FS in dev, a signed-in GitHub token in hosted mode).
  try {
    await getStorage();
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return (
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-bold">Заявки</h1>
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

  const { cursor } = await searchParams;

  let store;
  try {
    store = await getLeadsStore();
  } catch (err) {
    if (err instanceof LeadsNotConfiguredError) {
      return (
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-bold">Заявки</h1>
          <p className="mt-3 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
            {err.message} Перевірте змінну середовища <code>LEADS_DATABASE_URL</code>.
          </p>
        </main>
      );
    }
    throw err;
  }

  let page;
  let loadError: string | null = null;
  try {
    page = await store.list({ limit: PAGE_SIZE, cursor });
  } catch (err) {
    loadError = (err as Error).message;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Заявки</h1>
        <Link className="text-xs underline" href="/panel">
          ← до публікації
        </Link>
      </div>

      {store.kind === "demo" && <DemoBanner />}

      {loadError && (
        <p className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          Не вдалося завантажити список: {loadError}
        </p>
      )}

      {page && page.leads.length === 0 && !loadError && (
        <p className="mt-6 rounded border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          Заявок поки немає.
        </p>
      )}

      {page && page.leads.length > 0 && (
        <>
          <p className="mt-4 text-xs text-neutral-500">
            {page.total != null ? `Усього: ${page.total}. ` : ""}Показано {page.leads.length}.
          </p>
          <div className="mt-3 space-y-2">
            {page.leads.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
          </div>
          <div className="mt-4 flex gap-3 text-sm">
            {cursor && (
              <Link className="underline" href="/panel/leads">
                ⏮ на початок
              </Link>
            )}
            {page.nextCursor && (
              <Link className="underline" href={`/panel/leads?cursor=${encodeURIComponent(page.nextCursor)}`}>
                Наступні {PAGE_SIZE} →
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}
