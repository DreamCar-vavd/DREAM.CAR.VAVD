import { NextResponse } from "next/server";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import { LOCALES, type ContentLocale } from "@/lib/content/carsGate";
import { confirmLocale, publishCar, unpublishCar } from "@/lib/content/panelStore";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Panel write actions. Local file mode only for now: on a deployment these
 * writes must go through a GitHub commit, which needs the GitHub App
 * (report/34 §7). Until then a deployed panel returns 501 rather than
 * pretending to save.
 */
export async function POST(request: Request) {
  if (!keystaticEnabled) return json({ ok: false, message: "Панель вимкнена." }, 404);

  const isLocalMode = process.env.KEYSTATIC_STORAGE_KIND !== "github";
  if (!isLocalMode) {
    return json(
      {
        ok: false,
        message:
          "Публікація з hosted-панелі ще не підключена — потрібен GitHub App (див. report/34 §7). Локальний режим працює.",
      },
      501,
    );
  }

  let payload: { action?: string; carId?: string; locale?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Некоректний запит." }, 400);
  }

  const { action, carId } = payload;
  if (!carId || typeof carId !== "string") {
    return json({ ok: false, message: "Не вказано авто." }, 400);
  }

  switch (action) {
    case "confirm-locale": {
      const locale = payload.locale;
      if (!locale || !LOCALES.includes(locale as ContentLocale)) {
        return json({ ok: false, message: "Не вказано мову." }, 400);
      }
      return json(await confirmLocale(carId, locale as ContentLocale));
    }
    case "publish":
      return json(await publishCar(carId));
    case "unpublish":
      return json(await unpublishCar(carId));
    default:
      return json({ ok: false, message: `Невідома дія «${action}».` }, 400);
  }
}
