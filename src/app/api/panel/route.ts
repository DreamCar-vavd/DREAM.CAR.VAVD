import { NextResponse } from "next/server";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { LOCALES, type ContentLocale } from "@/lib/content/carsGate";
import { getStorage, NotConnectedError } from "@/lib/content/store";
import { completeDeletion, confirmLocale, publishItem, unpublishItem } from "@/lib/content/panelStore";
import { KINDS, type KindKey } from "@/lib/content/kinds";
import type { ActionResult } from "@/lib/content/panelStore";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Map a panelStore ActionResult onto the right HTTP status. */
function respond(r: ActionResult) {
  if (r.ok) return json(r, 200);
  if ("conflict" in r && r.conflict) return json(r, 409);
  if ("auth" in r && r.auth) return json(r, 401); // session ended
  if ("forbidden" in r && r.forbidden) return json(r, 403); // access refused
  // `transient` = GitHub unreachable / rate-limited / write outcome unknown;
  // the message itself tells the user to reload and check before retrying.
  if ("transient" in r && r.transient) return json(r, 503);
  return json(r, 400);
}

interface Body {
  action?: string;
  kind?: string;
  id?: string;
  locale?: string;
  /** version token per kind ("car"/"gallery"/"service"/"contact") + "review" + "published" */
  versions?: Record<string, string | undefined>;
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

  const v = body.versions ?? {};
  const review = String(v.review ?? "");
  const published = String(v.published ?? "");

  // "complete-deletion" is item-independent — it sweeps every orphaned
  // review-state row — so it is handled before the kind/id checks below.
  if (body.action === "complete-deletion") {
    return respond(await completeDeletion(storage, { review }));
  }

  const kind = body.kind as KindKey;
  if (!kind || !(kind in KINDS)) return json({ ok: false, message: "Не вказано розділ." }, 400);
  if (!body.id || typeof body.id !== "string") {
    return json({ ok: false, message: "Не вказано елемент." }, 400);
  }
  const workingVersion = String(v[kind] ?? "");

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
  return respond(r);
}
