import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { getStorage, NotConnectedError } from "@/lib/content/store";

/**
 * Toggles Next.js Draft Mode so an authorised panel user can view the current
 * WORKING content on the real site before publishing.
 *
 *   GET /api/panel/preview?path=/uk           -> enable, redirect to /uk
 *   GET /api/panel/preview?disable=1&path=/uk -> disable, redirect to /uk
 *
 * Enabling requires the same authorisation as the panel itself (local dev, or
 * a signed-in GitHub user in hosted mode). Disabling is always allowed.
 * Only same-origin relative paths are accepted as the redirect target.
 */
function safePath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function GET(request: Request) {
  if (!keystaticEnabled) return NextResponse.json({ error: "disabled" }, { status: 404 });

  const url = new URL(request.url);
  const target = safePath(url.searchParams.get("path"));
  const dm = await draftMode();

  if (url.searchParams.get("disable")) {
    dm.disable();
    return NextResponse.redirect(new URL(safePath(url.searchParams.get("path")) || "/panel", url));
  }

  try {
    await getStorage(); // throws NotConnectedError if github mode + not signed in
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  dm.enable();
  return NextResponse.redirect(new URL(target, url));
}
