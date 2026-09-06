import { NextResponse } from "next/server";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { LOCALES, type ContentLocale } from "@/lib/content/carsGate";
import { getStorage, NotConnectedError } from "@/lib/content/store";
import { confirmLocale, publishItem, unpublishItem } from "@/lib/content/panelStore";
import { KINDS, type KindKey } from "@/lib/content/kinds";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

interface Body {
  action?: string;
  kind?: string;
  id?: string;
  locale?: string;
  versions?: { car?: string; gallery?: string; review?: string; published?: string };
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

  const kind = body.kind as KindKey;
  if (!kind || !(kind in KINDS)) return json({ ok: false, message: "Не вказано розділ." }, 400);
  if (!body.id || typeof body.id !== "string") {
    return json({ ok: false, message: "Не вказано елемент." }, 400);
  }
  const v = body.versions ?? {};
  const workingVersion = kind === "car" ? String(v.car ?? "") : String(v.gallery ?? "");
  const review = String(v.review ?? "");
  const published = String(v.published ?? "");

  let r;
  switch (body.action) {
    case "confirm-locale":
      if (!body.locale || !LOCALES.includes(body.locale as ContentLocale)) {
        return json({ ok: false, message: "Не вказано мову." }, 400);
      }
      r = await confirmLocale(storage, kind, body.id, body.locale as ContentLocale, {
        working: workingVersion,
        review,
      });
      break;
    case "publish":
      r = await publishItem(storage, kind, body.id, { working: workingVersion, review, published });
      break;
    case "unpublish":
      r = await unpublishItem(storage, kind, body.id, { published });
      break;
    default:
      return json({ ok: false, message: `Невідома дія «${body.action}».` }, 400);
  }
  return json(r, r.ok ? 200 : "conflict" in r && r.conflict ? 409 : 400);
}
