"use client";

import { usePathname } from "next/navigation";

/**
 * Shown at the top of every public page while the viewer is in Draft Mode.
 * Normal visitors never see it and never get the cookie.
 *
 *  - active + version  -> previewing the current working copy
 *  - error             -> the draft could not be served (session revoked, or
 *                         a GitHub API failure); the page shows the published
 *                         version and this explains why
 */
export function DraftPreviewBanner({
  active,
  version,
  error,
}: {
  active: boolean;
  version?: string;
  error?: string;
}) {
  const pathname = usePathname();
  const back = encodeURIComponent(pathname || "/panel");
  const exit = `/api/panel/preview?disable=1&path=${back}`;

  if (!active && error) {
    return (
      <div
        role="alert"
        className="sticky top-0 z-[200] flex flex-wrap items-center justify-center gap-2 bg-red-600 px-3 py-1.5 text-center text-xs font-semibold text-white"
      >
        <span>{error} Показано опубліковану версію.</span>
        <a className="underline" href={exit}>
          Вийти з перегляду
        </a>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[200] flex flex-wrap items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-semibold text-black"
    >
      <span>
        {version ? `Чернетку завантажено, версія ${version}` : "Ви переглядаєте ЧЕРНЕТКУ"} — цієї
        версії ще немає на публічному сайті.
      </span>
      {error && <span className="text-red-900">({error})</span>}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- panel is a separate tree */}
      <a className="underline" href="/panel">
        До панелі
      </a>
      <a className="underline" href={exit}>
        Вийти з перегляду
      </a>
    </div>
  );
}
