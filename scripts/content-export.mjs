/**
 *   npm run content:export
 *
 * Writes a self-contained copy of everything the panel owns that LIVES IN GIT:
 *   export/<timestamp>/
 *     published.json, review-state.json
 *     cms/**                     (working copies: cars, gallery, services, contact, promos)
 *     images/cms/**              (only media referenced by published.json)
 *     MANIFEST.txt               (every file + sha256)
 *     EXTERNAL-RESOURCES.md      (what this export does NOT contain)
 *
 * It also checks that every photo/video reference in published.json resolves
 * to a real file (or is a legitimate external URL) and fails if not.
 *
 * This is NOT a full backup: uploaded videos (external storage), the leads
 * database, Vercel Analytics data and env secrets are outside Git — see
 * EXTERNAL-RESOURCES.md in the output.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const CMS = path.join(ROOT, "src/content/cms");
const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");

const MEDIA_RE =
  /^\/images\/cms\/(cars|gallery|services|promos)\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(jpe?g|png|webp|mp4|webm)$/;

async function walk(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(path.relative(base, full));
  }
  return out;
}

async function copyInto(srcAbs, destAbs) {
  await fs.mkdir(path.dirname(destAbs), { recursive: true });
  await fs.copyFile(srcAbs, destAbs);
}

function collectMediaRefs(published) {
  const refs = new Set();
  const external = [];
  const push = (where, v) => {
    const s = String(v ?? "").trim();
    if (!s) return;
    if (s.startsWith("http://") || s.startsWith("https://")) return external.push(`${where}: ${s}`);
    if (s.startsWith("/uploads/")) return external.push(`${where}: ${s} (зовнішнє сховище відео)`);
    refs.add(s);
  };
  for (const c of published.cars ?? []) {
    (c.photos ?? []).forEach((p, i) => push(`авто ${c.id} фото ${i}`, p.image));
    if (c.video?.src) push(`авто ${c.id} відео`, c.video.src);
    if (c.video?.posterSrc) push(`авто ${c.id} постер`, c.video.posterSrc);
  }
  for (const g of published.gallery ?? []) (g.photos ?? []).forEach((p, i) => push(`галерея ${g.id} фото ${i}`, p.image));
  for (const s of published.services ?? []) (s.photos ?? []).forEach((p, i) => push(`послуга ${s.id} фото ${i}`, p.image));
  for (const pr of published.promos ?? []) push(`матеріал ${pr.id} зображення`, pr.image);
  return { refs: [...refs], external };
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const OUT = path.join(ROOT, "export", stamp);
  await fs.mkdir(OUT, { recursive: true });

  const publishedRaw = await fs.readFile(path.join(CMS, "published.json"), "utf8");
  const published = JSON.parse(publishedRaw);

  const problems = [];
  const manifest = [];
  const add = async (relFromRoot, destRel) => {
    const srcAbs = path.join(ROOT, relFromRoot);
    const destAbs = path.join(OUT, destRel);
    await copyInto(srcAbs, destAbs);
    manifest.push(`${sha256(await fs.readFile(srcAbs))}  ${destRel}`);
  };

  await add("src/content/cms/published.json", "published.json");
  await add("src/content/cms/review-state.json", "review-state.json");

  for (const sub of ["cars", "gallery", "services", "contact", "promos"]) {
    for (const rel of await walk(path.join(CMS, sub))) {
      if (rel.endsWith(".json")) await add(`src/content/cms/${sub}/${rel}`, `cms/${sub}/${rel}`);
    }
  }

  const { refs, external } = collectMediaRefs(published);
  for (const ref of refs) {
    if (!MEDIA_RE.test(ref)) {
      problems.push(`посилання «${ref}» не відповідає дозволеному формату медіа`);
      continue;
    }
    const srcRel = `public${ref}`;
    try {
      await fs.access(path.join(ROOT, srcRel));
    } catch {
      problems.push(`медіафайл «${ref}» відсутній у репозиторії`);
      continue;
    }
    await add(srcRel, `images${ref.replace("/images", "")}`);
  }

  await fs.writeFile(path.join(OUT, "MANIFEST.txt"), manifest.sort().join("\n") + "\n");

  const ext = [
    "# Чого НЕМАЄ в цьому експорті (поза Git)",
    "",
    "Цей експорт — повний знімок контенту панелі, що зберігається в Git.",
    "`git clone` + цей експорт **не** покривають:",
    "",
    "## 1. Завантажені відео",
    external.filter((e) => e.includes("сховищ")).map((e) => `- ${e}`).join("\n") ||
      "- (наразі жодне опубліковане авто не використовує завантажене відео)",
    "",
    "Зберігаються у зовнішньому сховищі (Vercel Blob) або локально в",
    "`public/uploads/videos/` (git-ignored). Резервувати окремо: скопіювати",
    "вміст bucket'а / теки. Посилання в `published.json` залишаються дійсними,",
    "лише поки живий файл за URL.",
    "",
    "## 2. Інші зовнішні посилання в контенті",
    external.filter((e) => !e.includes("сховищ")).map((e) => `- ${e}`).join("\n") || "- (немає)",
    "",
    "## 3. База заявок (`LEADS_DATABASE_URL`)",
    "Postgres (Neon / Vercel Postgres). Резервування — засобами провайдера:",
    "Neon має point-in-time restore + `pg_dump`. Схема — `src/lib/leads/schema.sql`.",
    "Персональні дані — не тримати у файлових копіях без потреби.",
    "",
    "## 4. Дані Vercel Web Analytics / Speed Insights",
    "Зберігаються у Vercel, експорт — через їхній API / дашборд. Це агрегована",
    "анонімна статистика, не критична для відновлення сайту.",
    "",
    "## 5. Секрети (env)",
    "`KEYSTATIC_*`, `CONTACT_FORM_ENDPOINT`, `BLOB_READ_WRITE_TOKEN`,",
    "`LEADS_DATABASE_URL` — лише в Vercel Environment Variables. У копії їх нема",
    "й не має бути.",
    "",
  ].join("\n");
  await fs.writeFile(path.join(OUT, "EXTERNAL-RESOURCES.md"), ext);

  if (problems.length) {
    console.error("\n✗ експорт із зауваженнями:\n");
    for (const p of problems) console.error(`  • ${p}`);
    process.exit(1);
  }
  console.log(
    `✓ Експорт: ${OUT.replace(ROOT + "/", "")}\n` +
      `  ${manifest.length} файлів (${refs.length} медіа в Git, ${external.length} зовнішніх посилань).\n` +
      `  Див. EXTERNAL-RESOURCES.md — що поза Git.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
