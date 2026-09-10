import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { LOCALES, describeFailure, type ContentLocale } from "@/lib/content/carsGate";
import { getStorage, NotConnectedError, type DeployStatus } from "@/lib/content/store";
import {
  StorageAuthError,
  StorageBackendError,
  StorageForbiddenError,
} from "@/lib/content/store/adapter";
import { getPanelData, type PanelData, type PanelGroup, type PanelRow } from "@/lib/content/panelStore";
import { CleanupFrozenMediaButton, PanelButton, RefreshButton } from "./PanelActions";

export const dynamic = "force-dynamic";

const LANG_LABEL: Record<ContentLocale, string> = { uk: "UK", en: "EN", ru: "RU" };
const LANG_BADGE = {
  empty: { text: "Не заповнено", cls: "bg-red-100 text-red-800 border-red-300" },
  "needs-review": { text: "Потребує перевірки", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  reviewed: { text: "Перевірено", cls: "bg-green-100 text-green-800 border-green-300" },
} as const;

/** Shared shell for the pre-dashboard error screens. */
function ErrorMain({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-bold">Панель публікації</h1>
      {children}
    </main>
  );
}

function DeployBanner({
  deploy,
  mode,
  branch,
}: {
  deploy: DeployStatus;
  mode: "local" | "github";
  branch: string | null;
}) {
  if (mode === "local") {
    return (
      <p className="mt-2 text-xs text-neutral-500">
        Локальний режим: зміни у файлах одразу, кроку збірки немає.
      </p>
    );
  }
  const isTest = "isTest" in deploy && deploy.isTest;
  const where = isTest ? `на тестовому сайті гілки «${branch}»` : "в ефірі (Production)";
  const map: Record<DeployStatus["state"], { text: string; cls: string }> = {
    "n/a": { text: "", cls: "" },
    none: { text: "Деплой для поточного знімка не знайдено.", cls: "text-neutral-500" },
    unknown: {
      text: `ℹ Стан збірки невідомий: ${"reason" in deploy ? deploy.reason : ""}`,
      cls: "text-neutral-500",
    },
    pending: { text: `⏳ Збірка виконується — зміни ще не ${where}.`, cls: "text-amber-700" },
    ready: {
      text: `✅ Поточний знімок ${where}.`,
      cls: "text-green-700 dark:text-green-400",
    },
    error: {
      text: `⚠️ Збірка не вдалася — ${isTest ? "на тестовому сайті" : "в ефірі"} лишається попередня версія.`,
      cls: "text-red-600",
    },
  };
  const s = map[deploy.state];
  return (
    <p className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${s.cls}`}>
      <span>{s.text}</span>
      {"environment" in deploy && deploy.environment && (
        <span className="text-neutral-400">({deploy.environment})</span>
      )}
      {"url" in deploy && deploy.url && (
        <a className="underline" href={deploy.url} target="_blank" rel="noreferrer">
          відкрити
        </a>
      )}
      <RefreshButton />
    </p>
  );
}

function PublicState({ row }: { row: PanelRow }) {
  if (!row.publishedExists) {
    return <span className="text-neutral-500">Не опубліковане (нова чернетка)</span>;
  }
  return (
    <span>
      {row.publiclyVisible ? (
        <span className="text-green-700 dark:text-green-400">● На сайті</span>
      ) : (
        <span className="text-neutral-500">○ Опубліковане, приховане</span>
      )}
      {row.publishState === "modified" && (
        <span className="ml-2 rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
          є неопубліковані зміни
        </span>
      )}
    </span>
  );
}

function OrphanRow({
  row,
  kind,
  versions,
}: {
  row: PanelRow;
  kind: string;
  versions: PanelData["versions"];
}) {
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-semibold">{row.title}</span>{" "}
          <span className="text-xs text-neutral-500">{row.subtitle}</span>
        </div>
      </div>
      <p className="mt-2 rounded border border-amber-400 bg-amber-100 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
        Робочу картку видалено. Опублікована версія ще залишається на сайті.
      </p>
      <div className="mt-2 text-sm">
        <PublicState row={row} />
      </div>
      <div className="mt-3">
        <PanelButton
          payload={{ action: "unpublish", kind, id: row.id }}
          versions={versions}
          variant="danger"
          confirmText={`Прибрати «${row.id}» з сайту? Робочої картки вже немає — щоб повернути матеріал, доведеться створити її заново в Keystatic.`}
        >
          Прибрати з сайту
        </PanelButton>
      </div>
    </section>
  );
}

function Row({ row, kind, versions }: { row: PanelRow; kind: string; versions: PanelData["versions"] }) {
  if (!row.workingExists) return <OrphanRow row={row} kind={kind} versions={versions} />;
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-semibold">{row.title}</span>{" "}
          <span className="text-xs text-neutral-500">{row.subtitle}</span>
        </div>
        {row.editHref && (
          <a className="inline-block py-1 text-xs underline" href={row.editHref}>
            Редагувати в Keystatic →
          </a>
        )}
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
                  payload={{ action: "confirm-locale", kind, id: row.id, locale }}
                  versions={versions}
                  targetToken={row.localeTextToken[locale]}
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
          payload={{ action: "publish", kind, id: row.id }}
          versions={versions}
          variant="primary"
          disabled={row.blockers.length > 0 || row.publishState === "in-sync"}
          targetToken={row.publishTargetToken}
        >
          {row.publishedExists ? "Опублікувати зміни" : "Опублікувати"}
        </PanelButton>
        {row.publishedExists && (
          <PanelButton
            payload={{ action: "unpublish", kind, id: row.id }}
            versions={versions}
            variant="danger"
            confirmText={`Прибрати «${row.id}» з сайту? Робоча картка лишиться в панелі.`}
          >
            Прибрати з сайту
          </PanelButton>
        )}
      </div>
    </section>
  );
}

function Group({ group, versions }: { group: PanelGroup; versions: PanelData["versions"] }) {
  return (
    <div id={`group-${group.kind}`} className="scroll-mt-4">
      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{group.label}</h2>
        {group.createHref && (
          <a
            className="inline-flex min-h-[36px] items-center rounded border border-neutral-400 px-3 py-1.5 text-xs underline hover:bg-neutral-100 dark:hover:bg-neutral-800"
            href={group.createHref}
          >
            + Створити в Keystatic
          </a>
        )}
      </div>
      {group.singleEntry && (
        <p className="mt-1 text-xs text-neutral-500">
          Один запис на весь сайт. Дані вводяться раз, підписи — окремо трьома мовами.
        </p>
      )}
      <div className="mt-3 space-y-4">
        {group.rows.length === 0 && (
          <p className="rounded border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700">
            Матеріалів ще немає.{" "}
            {group.createHref ? (
              <a className="underline" href={group.createHref}>
                Створити перший у Keystatic →
              </a>
            ) : (
              "Заповніть запис у Keystatic."
            )}
          </p>
        )}
        {group.rows.map((row) => (
          <Row key={row.id} row={row} kind={group.kind} versions={versions} />
        ))}
      </div>
    </div>
  );
}

/**
 * Keystatic "Delete entry" removes the card JSON but never its review-state
 * row (its delete is a direct commit the panel does not see). This lists the
 * leftovers and offers ONE button to sweep them — the on-demand version of the
 * cleanup that otherwise only happens on the next "Позначити перевіреним".
 * An orphan still on the public site is taken down with its own "Прибрати з
 * сайту" button in the group below; that is called out per slug here.
 */
function PendingDeletions({
  slugs,
  groups,
  versions,
}: {
  slugs: string[];
  groups: PanelGroup[];
  versions: PanelData["versions"];
}) {
  if (slugs.length === 0) return null;
  const orphanPublished = new Set(
    groups.flatMap((g) => g.rows.filter((r) => r.publishState === "orphan-published").map((r) => r.id)),
  );
  // stale keys are `kind:slug`; the orphan rows are keyed by the bare slug.
  const bareSlug = (key: string) => (key.includes(":") ? key.slice(key.indexOf(":") + 1) : key);
  return (
    <section className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      <p className="font-semibold text-amber-900 dark:text-amber-200">Незавершені видалення</p>
      <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
        Ці картки видалено в Keystatic. Залишилось прибрати службові записи, які
        видалення в Keystatic не чіпає:
      </p>
      <ul className="mt-2 list-disc pl-5 text-xs text-amber-900 dark:text-amber-200">
        {slugs.map((slug) => (
          <li key={slug}>
            <code>{bareSlug(slug)}</code> — рядок підтверджень перекладу
            {orphanPublished.has(bareSlug(slug)) && (
              <>
                {" "}
                <strong>
                  + опублікована версія ще на сайті — приберіть її кнопкою «Прибрати з
                  сайту» нижче
                </strong>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
        Кнопка прибирає лише рядки підтверджень для карток, яких уже немає в
        Keystatic. Наявні картки та їх підтвердження не змінюються. Якщо картку
        згодом створити знову — вона все одно потребуватиме нового підтвердження мов.
      </p>
      <div className="mt-3">
        <PanelButton
          payload={{ action: "complete-deletion" }}
          versions={versions}
          variant="solid"
          checkExtra={{ slugs }}
        >
          Завершити видалення ({slugs.length})
        </PanelButton>
      </div>
    </section>
  );
}

function PendingSummary({ groups }: { groups: PanelGroup[] }) {
  const changed: string[] = [];
  const blocked: string[] = [];
  for (const g of groups) {
    for (const row of g.rows) {
      const isNew = !row.publishedExists;
      const isModified = row.publishState === "modified";
      if (!isNew && !isModified) continue;
      const label = `${g.label} → ${row.title}`;
      if (row.blockers.length > 0) {
        const langs = LOCALES.filter((l) => row.langStatus[l] !== "reviewed").map(
          (l) => LANG_LABEL[l],
        );
        blocked.push(
          `${label}: ${row.blockers.length} пункт(и)${langs.length ? `, завершити мови: ${langs.join(", ")}` : ""}`,
        );
      } else {
        changed.push(`${label} (${isNew ? "нова чернетка" : "є зміни"})`);
      }
    }
  }

  if (changed.length === 0 && blocked.length === 0) {
    return (
      <p className="mt-4 rounded border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
        Неопублікованих змін немає — сайт відповідає робочим карткам.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      <p className="font-semibold text-amber-900 dark:text-amber-200">Неопубліковані зміни</p>
      {changed.length > 0 && (
        <>
          <p className="mt-2 text-xs font-semibold text-green-800 dark:text-green-400">
            Готове до публікації (кнопка «Опублікувати зміни» публікує лише свою картку):
          </p>
          <ul className="list-disc pl-5 text-xs text-amber-900 dark:text-amber-200">
            {changed.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {blocked.length > 0 && (
        <>
          <p className="mt-2 text-xs font-semibold text-red-800 dark:text-red-400">
            Публікацію заблоковано (потрібно завершити):
          </p>
          <ul className="list-disc pl-5 text-xs text-red-800 dark:text-red-300">
            {blocked.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default async function PanelPage() {
  if (!keystaticEnabled) notFound();

  // Local-only: `PANEL_DEV_SLOW_MS=1500 next dev` makes the server render pause so
  // `loading.tsx` is actually visible for a screenshot / manual check. Ignored in
  // production builds and whenever the var is unset or non-numeric.
  const slow = process.env.NODE_ENV !== "production" && Number(process.env.PANEL_DEV_SLOW_MS);
  if (slow && slow > 0) await new Promise((r) => setTimeout(r, Math.min(slow, 10_000)));

  let data: PanelData;
  try {
    data = await getPanelData(await getStorage());
  } catch (err) {
    if (err instanceof NotConnectedError || err instanceof StorageAuthError) {
      // Not signed in, or the 401 session ended — both recover by signing in.
      return (
        <ErrorMain>
          <p className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {err.message}
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- separate app tree */}
          <a className="mt-3 inline-block underline" href="/keystatic">
            Відкрити Keystatic і увійти →
          </a>
        </ErrorMain>
      );
    }
    if (err instanceof StorageForbiddenError) {
      // 403 — access was refused; a fresh sign-in will not restore a permission
      // the token never had. Offer /keystatic anyway (harmless) but do not
      // promise it fixes anything.
      return (
        <ErrorMain>
          <p className="mt-3 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {err.message}
          </p>
          <p className="mt-3">
            <RefreshButton />
          </p>
        </ErrorMain>
      );
    }
    if (err instanceof StorageBackendError && err.retriable) {
      // Unreachable or rate-limited — the content is NOT lost and NOT empty;
      // say what happened and offer a retry (never a blank dashboard).
      return (
        <ErrorMain>
          <p className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {err.message}
          </p>
          <p className="mt-3">
            <RefreshButton />
          </p>
        </ErrorMain>
      );
    }
    throw err;
  }

  const keystaticHref = data.branch
    ? `/keystatic/branch/${encodeURIComponent(data.branch)}`
    : "/keystatic";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold">Панель публікації</h1>
      {data.mode === "github" && data.branch && (
        <p className="mt-1 text-sm">
          Робоча гілка:{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
            {data.branch}
          </code>{" "}
          <span className="text-xs text-neutral-500">
            {data.branch === "main"
              ? "(Production)"
              : "(тестова гілка — не Production; редактор і перегляд чернетки відкриваються саме на ній)"}
          </span>
        </p>
      )}
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Редагування — у{" "}
        <a className="underline" href={keystaticHref}>
          Keystatic
        </a>
        . Зміни там <strong>не потрапляють на сайт</strong>, поки ви не опублікуєте їх тут.
      </p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Процес: <em>редагувати</em> → <em>позначити кожну мову перевіреною</em> →{" "}
        <em>«Опублікувати зміни»</em> → дочекатися завершення збірки.
      </p>
      <p className="mt-2 text-sm">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler, needs a full request */}
        <a
          className="rounded border border-amber-500 bg-amber-50 px-2 py-1 text-amber-900 underline dark:bg-amber-950 dark:text-amber-200"
          href="/api/panel/preview?path=/uk"
        >
          Переглянути чернетку на сайті →
        </a>{" "}
        <span className="text-xs text-neutral-500">
          (робоча версія на реальному макеті сайту, ще не опублікована)
        </span>
      </p>
      <p className="mt-2 text-sm">
        <Link className="inline-block py-1 underline" href="/panel/leads">
          Заявки з форми →
        </Link>{" "}
        <span className="text-xs text-neutral-500">(перегляд; база ще не підключена — демо-дані)</span>
      </p>
      <p className="mt-1 text-sm">
        <Link className="inline-block py-1 underline" href="/panel/video">
          Відео авто →
        </Link>{" "}
        <span className="text-xs text-neutral-500">
          (завантаження відеофайлів — локально; на хостингу потрібне зовнішнє сховище)
        </span>
      </p>

      <nav className="mt-3 flex flex-wrap gap-2 text-xs">
        {data.groups.map((g) => (
          <a
            key={g.kind}
            href={`#group-${g.kind}`}
            className="inline-flex min-h-[34px] items-center rounded-full border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {g.label}
          </a>
        ))}
      </nav>

      <DeployBanner deploy={data.deploy} mode={data.mode} branch={data.branch} />
      {data.publishedAt && (
        <p className="mt-1 text-xs text-neutral-500">
          Остання публікація: {new Date(data.publishedAt).toLocaleString("uk-UA")}
        </p>
      )}

      <PendingDeletions
        slugs={data.staleReviewSlugs}
        groups={data.groups}
        versions={data.versions}
      />

      <PendingSummary groups={data.groups} />


      {data.groups.map((group) => (
        <Group key={group.kind} group={group} versions={data.versions} />
      ))}

      <div className="mt-10 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">
          Обслуговування: після кількох замін фото на сайті лишаються старі копії
          зображень (вони нічому не шкодять). Натисніть — покаже, скільки їх і на
          який обсяг; підтвердіть, щоб прибрати. Робіть це, коли ніхто нічого не
          публікує. Ніколи не чіпає фото, потрібні поточній опублікованій версії.
        </p>
        <div className="mt-2">
          <CleanupFrozenMediaButton
            publishedVersion={data.versions.published}
            headSha={data.headSha}
          />
        </div>
      </div>
    </main>
  );
}
