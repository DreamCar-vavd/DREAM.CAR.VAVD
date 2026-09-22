/**
 *   LEADS_DATABASE_URL=postgres://… npm run leads:migrate
 *
 * Applies src/lib/leads/schema.sql to the leads database. Idempotent
 * (CREATE TABLE / INDEX IF NOT EXISTS). Prints the resulting columns.
 *
 * Needs `pg` (already a dependency) and a reachable database. Does nothing
 * destructive — no DROP, no data changes.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.LEADS_DATABASE_URL?.trim();
if (!url) {
  console.error("✗ LEADS_DATABASE_URL не задано.");
  process.exit(1);
}

const schemaPath = path.resolve(import.meta.dirname, "../src/lib/leads/schema.sql");

async function main() {
  const sql = await fs.readFile(schemaPath, "utf8");
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query(sql);
    const cols = await client.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'leads'
       ORDER BY ordinal_position`,
    );
    console.log("✓ Міграцію застосовано. Колонки leads:");
    for (const c of cols.rows) console.log(`  ${c.column_name} : ${c.data_type}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
