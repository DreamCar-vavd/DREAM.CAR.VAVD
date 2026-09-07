-- Panel leads (contact-form submissions). Postgres (Neon / Vercel Postgres).
--
-- Migration: run once against the database named by LEADS_DATABASE_URL.
-- The PostgresLeadsStore adapter (src/lib/leads/store.ts) is the remaining
-- hosted work; this is the schema it targets.
--
-- Privacy: rows contain personal data. The database must be private, the
-- adapter must never log row contents, and the panel read route
-- (/panel/leads) is dynamic + no-store + behind the storage-session gate.
-- Retention / export / deletion: see report — not automated.

CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  name            text NOT NULL,
  phone           text NOT NULL DEFAULT '',
  email           text NOT NULL DEFAULT '',
  service         text NOT NULL DEFAULT '',
  vehicle         text NOT NULL DEFAULT '',
  message         text NOT NULL DEFAULT '',
  -- sha256(name|phone-digits|email|message|10-min-bucket); see deriveIdempotencyKey.
  idempotency_key text NOT NULL,
  -- Optional soft-delete for the retention policy (never hard-deleted by code).
  deleted_at      timestamptz
);

-- Retry-safe insert: INSERT ... ON CONFLICT (idempotency_key) DO NOTHING.
CREATE UNIQUE INDEX IF NOT EXISTS leads_idempotency_key_uidx ON leads (idempotency_key);

-- Cursor pagination is by (created_at DESC, id) — a covering index keeps it cheap.
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC, id);

-- The adapter's write, for reference:
--   INSERT INTO leads (name, phone, email, service, vehicle, message, idempotency_key)
--   VALUES ($1,$2,$3,$4,$5,$6,$7)
--   ON CONFLICT (idempotency_key) DO NOTHING
--   RETURNING id;
-- (0 rows returned == deduped retry; still report the submission as saved.)
--
-- The adapter's read (one page):
--   SELECT id, created_at, name, phone, email, service, vehicle, message
--   FROM leads
--   WHERE deleted_at IS NULL AND (created_at, id) < ($cursor_ts, $cursor_id)
--   ORDER BY created_at DESC, id DESC
--   LIMIT $limit;
