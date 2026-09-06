"use client";

import { usePathname } from "next/navigation";

/**
 * Shown at the top of every public page ONLY while the viewer is in Draft
 * Mode (an authorised panel user previewing unpublished content). Normal
 * visitors never see it and never get the cookie.
 */
export function DraftPreviewBanner() {
  const pathname = usePathname();
  const back = encodeURIComponent(pathname || "/panel");
  return (
    <div
      role="status"
      className="sticky top-0 z-[200] flex flex-wrap items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-semibold text-black"
    >
      <span>
        Ви переглядаєте <strong>ЧЕРНЕТКУ</strong> — цієї версії ще немає на
        публічному сайті.
      </span>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- panel is a separate tree */}
      <a className="underline" href="/panel">
        До панелі
      </a>
      <a className="underline" href={`/api/panel/preview?disable=1&path=${back}`}>
        Вийти з перегляду
      </a>
    </div>
  );
}
