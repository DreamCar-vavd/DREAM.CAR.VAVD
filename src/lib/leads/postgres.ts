/**
 * Real leads adapter (Postgres — Neon / Vercel Postgres / any). Schema +
 * migration: src/lib/leads/schema.sql (also run by `npm run leads:migrate`).
 *
 * The query logic is written over a tiny `Queryable` interface so it is unit
 * tested without a database; `getPgLeadsStore()` binds it to a real `pg` Pool
 * created lazily from LEADS_DATABASE_URL.
 */
import type { Lead, LeadInput, LeadsPage, WritableLeadsStore } from "./store";

export interface Queryable {
  query<R = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

const PAGE_MAX = 100;

interface Row {
  id: string;
  created_at: Date | string;
  name: string;
  phone: string;
  email: string;
  service: string;
  vehicle: string;
  message: string;
}

const toLead = (r: Row): Lead => ({
  id: String(r.id),
  createdAt: (r.created_at instanceof Date ? r.created_at : new Date(r.created_at)).toISOString(),
  name: r.name ?? "",
  phone: r.phone ?? "",
  email: r.email ?? "",
  service: r.service ?? "",
  vehicle: r.vehicle ?? "",
  message: r.message ?? "",
  demo: false,
});

/** cursor = base64("<iso>|<id>") of the last row on the previous page */
export function encodeCursor(lead: Lead): string {
  return Buffer.from(`${lead.createdAt}|${lead.id}`, "utf8").toString("base64url");
}
export function decodeCursor(cursor: string): { ts: string; id: string } | null {
  try {
    const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!ts || !id) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

export function createPgLeadsStore(db: Queryable): WritableLeadsStore {
  return {
    kind: "database",

    async create(input: LeadInput, keys: { current: string; previous: string }) {
      // Boundary-safe dedup: a straddling retry may already be stored under the
      // PREVIOUS bucket's key. If either key is present, do not insert again.
      const dup = await db.query<{ id: string }>(
        `SELECT id FROM leads
         WHERE idempotency_key IN ($1, $2)
         ORDER BY created_at DESC LIMIT 1`,
        [keys.current, keys.previous],
      );
      if (dup.rows[0]?.id) return { id: dup.rows[0].id, inserted: false };

      // ON CONFLICT DO NOTHING also guards the race where two identical
      // requests land at once — the loser gets 0 rows and we re-select.
      const res = await db.query<{ id: string }>(
        `INSERT INTO leads (name, phone, email, service, vehicle, message, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [input.name, input.phone, input.email, input.service, input.vehicle, input.message, keys.current],
      );
      if (res.rows[0]?.id) return { id: res.rows[0].id, inserted: true };

      const found = await db.query<{ id: string }>(
        `SELECT id FROM leads WHERE idempotency_key = $1`,
        [keys.current],
      );
      return { id: found.rows[0]?.id ?? "", inserted: false };
    },

    async list({ limit, cursor }: { limit: number; cursor?: string | null }): Promise<LeadsPage> {
      const lim = Math.min(Math.max(1, limit || 20), PAGE_MAX);
      const cur = cursor ? decodeCursor(cursor) : null;
      const where = cur ? `WHERE deleted_at IS NULL AND (created_at, id) < ($1, $2)` : `WHERE deleted_at IS NULL`;
      const params = cur ? [cur.ts, cur.id, lim + 1] : [lim + 1];
      const res = await db.query<Row>(
        `SELECT id, created_at, name, phone, email, service, vehicle, message
         FROM leads ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT $${params.length}`,
        params,
      );
      const rows = res.rows.map(toLead);
      const hasMore = rows.length > lim;
      const leads = hasMore ? rows.slice(0, lim) : rows;
      const totalRes = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM leads WHERE deleted_at IS NULL`,
      );
      return {
        leads,
        nextCursor: hasMore ? encodeCursor(leads[leads.length - 1]) : null,
        total: totalRes.rows[0]?.n != null ? Number(totalRes.rows[0].n) : null,
      };
    },

    async get(id: string): Promise<Lead | null> {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const res = await db.query<Row>(
        `SELECT id, created_at, name, phone, email, service, vehicle, message
         FROM leads WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      return res.rows[0] ? toLead(res.rows[0]) : null;
    },
  };
}

// --- real pool -----------------------------------------------------------

let poolPromise: Promise<Queryable> | null = null;

async function getPool(): Promise<Queryable> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: process.env.LEADS_DATABASE_URL,
        max: 3,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 5_000,
      });
      return pool as unknown as Queryable;
    })();
  }
  return poolPromise;
}

export async function getPgLeadsStore(): Promise<WritableLeadsStore> {
  return createPgLeadsStore(await getPool());
}
