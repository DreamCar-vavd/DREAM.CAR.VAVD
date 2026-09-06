import { NextResponse } from "next/server";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { LOCALES, type ContentLocale } from "@/lib/content/carsGate";
import { getStorage, NotConnectedError } from "@/lib/content/store";
import { confirmLocale, publishCar, unpublishCar } from "@/lib/content/panelStore";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

interface Body {
  action?: string;
  carId?: string;
  locale?: string;
  versions?: { working?: string; review?: string; published?: string };
}

export async function POST(request: Request) {
  if (!keystaticEnabled) return json({ ok: false, message: "Панель вимкнена." }, 404);

  let storage;
  try {
    storage = await getStorage();
  } catch (err) {
    if (err instanceof NotConnectedError) return json({ ok: false, message: err.message }, 401);
    throw err;
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, message: "Некоректний запит." }, 400);
  }

  const { action, carId } = body;
  const v = body.versions ?? {};
  const versions = {
    working: String(v.working ?? ""),
    review: String(v.review ?? ""),
    published: String(v.published ?? ""),
  };
  if (!carId || typeof carId !== "string") {
    return json({ ok: false, message: "Не вказано авто." }, 400);
  }

  switch (action) {
    case "confirm-locale": {
      if (!body.locale || !LOCALES.includes(body.locale as ContentLocale)) {
        return json({ ok: false, message: "Не вказано мову." }, 400);
      }
      const r = await confirmLocale(storage, carId, body.locale as ContentLocale, {
        review: versions.review,
        working: versions.working,
      });
      return json(r, r.ok ? 200 : "conflict" in r && r.conflict ? 409 : 400);
    }
    case "publish": {
      const r = await publishCar(storage, carId, versions);
      return json(r, r.ok ? 200 : "conflict" in r && r.conflict ? 409 : 400);
    }
    case "unpublish": {
      const r = await unpublishCar(storage, carId, versions.published);
      return json(r, r.ok ? 200 : "conflict" in r && r.conflict ? 409 : 400);
    }
    default:
      return json({ ok: false, message: `Невідома дія «${action}».` }, 400);
  }
}
