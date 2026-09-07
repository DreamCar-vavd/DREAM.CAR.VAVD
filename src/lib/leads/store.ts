/**
 * Incoming contact-form submissions ("заявки"), read-only, for the panel.
 *
 * (No `import "server-only"` here so the pure demo generator stays unit
 * testable under node:test — only server components import this module, and
 * it touches nothing but `process.env` and `Math`.)
 *
 * NO database is wired yet. Until `LEADS_DATABASE_URL` is set, `getLeadsStore()`
 * returns a DEMO store that generates synthetic rows in memory — they are
 * clearly labelled in the UI, never written to Git, a static file, or any
 * public cache, and never leave the server unlabelled. The real adapter
 * (Neon / Postgres) implements the same interface; nothing else changes.
 *
 * This layer is read-only on purpose: submissions are delivered by the
 * existing Formspree/endpoint pipeline (env `CONTACT_FORM_ENDPOINT`), which
 * this does not touch. Wiring a database here would ADD a durable copy for
 * the owner to browse — it must not change or duplicate delivery.
 */

export interface Lead {
  id: string;
  /** ISO timestamp */
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  /** service slug or free text as submitted */
  service: string;
  vehicle: string;
  message: string;
  /** true when this row is synthetic demo data, not a real submission */
  demo: boolean;
}

export interface LeadsPage {
  leads: Lead[];
  /** opaque cursor for the next page, or null at the end */
  nextCursor: string | null;
  /** total count when the backend can give one cheaply */
  total: number | null;
}

export interface LeadsStore {
  readonly kind: "demo" | "database";
  list(opts: { limit: number; cursor?: string | null }): Promise<LeadsPage>;
  get(id: string): Promise<Lead | null>;
}

export class LeadsNotConfiguredError extends Error {
  constructor() {
    super("Базу заявок не підключено.");
    this.name = "LeadsNotConfiguredError";
  }
}

// --- demo store ------------------------------------------------------------

const DEMO_SERVICES = ["car-selection", "diagnostics", "srs-airbag", "за домовленістю", "car-service"];
const DEMO_NAMES = ["Олег К.", "Sarah M.", "Іван П.", "James T.", "Марина Л.", "Андрій В.", "Kate R."];
const DEMO_VEHICLES = ["BMW 320d, 2016", "Audi A4, 2018", "", "Ford Focus, 2015", "VW Passat B8"];
const DEMO_MESSAGES = [
  "Доброго дня, цікавить діагностика перед покупкою.",
  "Please call me back regarding an inspection.",
  "Потрібна консультація щодо підбору авто до £8000.",
  "Коли можна записатися на цей тиждень?",
  "",
];

/** Deterministic pseudo-random so the demo list is stable between renders. */
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

class DemoLeadsStore implements LeadsStore {
  readonly kind = "demo" as const;
  private readonly count = 47;

  private row(i: number): Lead {
    const r = (k: number) => seeded(i * 7 + k);
    const daysAgo = Math.floor(r(1) * 60);
    const created = new Date(Date.UTC(2026, 8, 7) - daysAgo * 86_400_000 - Math.floor(r(2) * 86_400_000));
    return {
      id: `demo-${String(i).padStart(3, "0")}`,
      createdAt: created.toISOString(),
      name: DEMO_NAMES[i % DEMO_NAMES.length],
      phone: `+44 7${String(100_000_000 + Math.floor(r(3) * 899_999_999)).slice(0, 9)}`,
      email: r(4) > 0.4 ? `user${i}@example.com` : "",
      service: DEMO_SERVICES[i % DEMO_SERVICES.length],
      vehicle: DEMO_VEHICLES[i % DEMO_VEHICLES.length],
      message: DEMO_MESSAGES[i % DEMO_MESSAGES.length],
      demo: true,
    };
  }

  async list({ limit, cursor }: { limit: number; cursor?: string | null }): Promise<LeadsPage> {
    const all = Array.from({ length: this.count }, (_, i) => this.row(i)).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const start = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
    const slice = all.slice(start, start + limit);
    const next = start + limit;
    return {
      leads: slice,
      nextCursor: next < all.length ? String(next) : null,
      total: all.length,
    };
  }

  async get(id: string): Promise<Lead | null> {
    const m = /^demo-(\d+)$/.exec(id);
    if (!m) return null;
    const i = parseInt(m[1], 10);
    return i >= 0 && i < this.count ? this.row(i) : null;
  }
}

export async function getLeadsStore(): Promise<LeadsStore> {
  const url = process.env.LEADS_DATABASE_URL?.trim();
  if (!url) return new DemoLeadsStore();
  // Real adapter not implemented yet — a URL being set must not silently fall
  // back to demo data (that would look like real leads vanished).
  throw new LeadsNotConfiguredError();
}
