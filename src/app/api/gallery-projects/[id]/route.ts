import { NextResponse } from "next/server";
import { locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { writeGalleryProjectOverride } from "@/lib/galleryProjectOverrides";
import type { GalleryProjectCopy } from "@/content/types";

function isDevOnly() {
  return process.env.NODE_ENV === "development";
}

function sanitizeCopy(input: unknown): GalleryProjectCopy | null {
  if (typeof input !== "object" || input === null) return null;
  const value = input as Record<string, unknown>;

  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title) return null;

  const year = typeof value.year === "string" ? value.year.trim() : "";
  const service = typeof value.service === "string" ? value.service.trim() : "";
  const clientRequest = typeof value.clientRequest === "string" ? value.clientRequest.trim() : "";
  const result = typeof value.result === "string" ? value.result.trim() : "";
  const completedItems = Array.isArray(value.completedItems)
    ? value.completedItems
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

  return { title, year, service, clientRequest, completedItems, result };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDevOnly()) {
    return NextResponse.json({ error: "Not available in production." }, { status: 403 });
  }
  const { id } = await params;

  const result: Partial<Record<string, GalleryProjectCopy>> = {};
  for (const locale of locales) {
    const dict = await getDictionary(locale);
    const copy = dict.gallery.projects[id as keyof typeof dict.gallery.projects];
    if (!copy) {
      return NextResponse.json({ error: "Unknown gallery project id." }, { status: 404 });
    }
    result[locale] = copy;
  }

  return NextResponse.json({ locales: result });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDevOnly()) {
    return NextResponse.json({ error: "Not available in production." }, { status: 403 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("locales" in body)) {
    return NextResponse.json({ error: "Missing locales payload." }, { status: 400 });
  }
  const incomingLocales = (body as { locales: unknown }).locales;
  if (typeof incomingLocales !== "object" || incomingLocales === null) {
    return NextResponse.json({ error: "Missing locales payload." }, { status: 400 });
  }

  const sanitized: Partial<Record<string, GalleryProjectCopy>> = {};
  for (const locale of locales) {
    const raw = (incomingLocales as Record<string, unknown>)[locale];
    const copy = sanitizeCopy(raw);
    if (!copy) {
      return NextResponse.json(
        { error: `The vehicle title is required for "${locale}".` },
        { status: 400 },
      );
    }
    sanitized[locale] = copy;
  }

  try {
    for (const locale of locales) {
      await writeGalleryProjectOverride(id, locale, sanitized[locale]!);
    }
  } catch {
    return NextResponse.json({ error: "Failed to save changes on disk." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, locales: sanitized });
}
