/**
 * The panel leads list ( /panel/leads ) can fail to load when the database is
 * unreachable, misconfigured, or rejects the credentials. Those errors come
 * from `pg` / Node's DNS layer and their `.message` routinely carries
 * connection details:
 *
 *   getaddrinfo ENOTFOUND ep-cool-name-123.eu-central-1.aws.neon.tech
 *   connect ECONNREFUSED 10.0.0.4:5432
 *   password authentication failed for user "leads_app"
 *   database "leads_prod" does not exist
 *
 * None of that belongs in the panel UI or in the application logs. This
 * helper turns any such error into a fixed, safe user message plus a coarse
 * code (the error's `.code`/`.name` only — `ENOTFOUND`, `28P01`, …) that is
 * safe to log for diagnosis.
 */

export const LEADS_LIST_ERROR_MESSAGE =
  "Не вдалося завантажити список заявок. Перевірте підключення бази даних (див. docs/PANEL-leads-db.md).";

export interface LeadsListErrorView {
  /** Safe, constant text for the panel. Never contains the raw error. */
  message: string;
  /** Coarse, host-free code for a single server-side log line. */
  logCode: string;
}

export function leadsListErrorView(err: unknown): LeadsListErrorView {
  const e = (err ?? {}) as { code?: unknown; name?: unknown };
  const raw =
    (typeof e.code === "string" && e.code) ||
    (typeof e.name === "string" && e.name) ||
    "unknown";
  // Postgres SQLSTATE codes are alphanumeric; Node system errors are
  // UPPER_SNAKE. Anything else is discarded so a crafted `.code` string can
  // never smuggle host text into the log.
  const logCode = raw.replace(/[^A-Za-z0-9_]/g, "").slice(0, 32) || "unknown";
  return { message: LEADS_LIST_ERROR_MESSAGE, logCode };
}
