# zzz-test-panel — журнал виконання (2026-09-09)

Repo: DreamCar-vavd/DREAM.CAR.VAVD · branch codex/admin-panel-spike
Preview alias: dreamcarvavd-git-codex-admin-p-648563-6y7h9wdz4r-7375s-projects.vercel.app
Baseline copy: /Users/apple/Projects/dcv-restore-verify-20260909/repo (+ /baseline)

## Baseline (Stage 1)
- BRANCH_SHA_0 = df71921675a973e82265fe0e66d71744b78c6700
- MAIN_SHA_0   = ce1977af140b49dce4bb79001c7eeed5e01aa2c2
- zzz-test-panel: ABSENT from content/public (git grep = none); Keystatic services list = 5; panel = 3/8/5/1/0
- published.json.publishedAt (baseline) = 2026-09-06T00:00:00.000Z
- review-state top keys: 16 materials + "site"
- media: 51 cms + 6 premium-3d; 0 files under public/images/cms/services/
- content hashes: baseline/content-hashes.txt
- main copy clean at df71921, no local uncommitted changes

## Commits (all by Keystatic/panel, branch codex/admin-panel-spike)
| # | SHA | stage | message | files |
|---|-----|-------|---------|-------|
| 1 | 2504e74d54f9d86fa1cc722ff93ca1476af7a8b2 | 2 create | Update …/zzz-test-panel | zzz-test-panel.json |
| 2 | 3175d9d91b612a4946990d9a722afef07c269ca4 | 2 fix order 100→999 | Update …/zzz-test-panel | zzz-test-panel.json |
| 3 | 55d45b358212ebab9354ca30e70aa8e1d75c6f3b | 3 add photo | Update …/zzz-test-panel | public/images/cms/services/zzz-test-panel/photos/0/image.jpg + zzz-test-panel.json |
| 4 | 789e5b08ca… | 3.2 confirm UK | panel: update review-state.json | review-state.json |
| 5 | c540b781ce… | 3.2 confirm EN | panel: update review-state.json | review-state.json |
| 6 | a64287d31c… | 3.2 confirm RU | panel: update review-state.json | review-state.json |
| 7 | 26cf462eca30bb0b57969f975e7574acf673f766 | 3.3 edit uk.shortDescription | Update …/zzz-test-panel | zzz-test-panel.json |
| 8 | 8607347f7b… | 3.3 re-confirm UK | panel: update review-state.json | review-state.json |
| 9 | e4324ddbe4… | 3.4 priceAmount→60 | Update …/zzz-test-panel | zzz-test-panel.json |

## Stage 3 results
- 3.1 publish blocked before all langs confirmed: CONFIRMED (button disabled:true, 3 blockers listed)
- 3.2 after confirming UK+EN+RU: button enabled (disabled:false); review-state added key zzz-test-panel only, 0 existing keys changed/removed
- 3.3 edit uk.shortDescription → only UK back to "Потребує перевірки"; EN/RU stay "Перевірено": CONFIRMED
- 3.4 priceAmount ""→"60" → all 3 langs stay "Перевірено", button stays enabled: CONFIRMED (price not in review hash)
- 3.5 photo: separate file public/images/cms/services/zzz-test-panel/photos/0/image.jpg (byte-identical to source, sha256 15d3147a…); renders in Keystatic editor; on fresh reload editor fetches raw.githubusercontent.com/.../image.jpg → 200 (CSP b038580 OK)
- Public services UI does NOT render photos (known gap, separate task) — not checked as "photo shown on site"

## Stage 4 results — draft vs viewer (before publish), separate cookie states
- HEAD e4324dd → deployment AXCiLcudEemigDj8yRwuiA2SrahH (Ready)
- VIEWER (no __prerender_bypass): /uk|/en|/ru /services/zzz-test-panel → 404, 404, 404; not in /uk/ services list; no "DELETE ME"
- EDITOR DRAFT (via /api/panel/preview?path=/uk → draft banner "версія 6cccdc0e"):
  /uk|/en|/ru /services/zzz-test-panel → 200, 200, 200; page shows title "ZZZ Тест панелі — видалити",
  "Незабаром" badge, £60, longDescription. Photo NOT rendered (UI gap). On Preview host.
- Draft disabled via /api/panel/preview?disable=1 → back to 404 + absent from list. Viewer state clean.
- Vercel Deployment Protection NOT touched.

## Stage 5 results — publish
- pre-publish branch HEAD: e4324dd
- publish commit: 3016287f13aba33c6938c5e68ae63aad7a79665a "panel: update src/content/cms/published.json" (only published.json)
- deployment: HRsBLhiGZfftQWsA55ZHCaKEvznJ — Ready, Preview, 34s; Vercel dashboard Domains list shows
  the branch alias assigned to THIS deployment; Source = codex/admin-panel-spike @ 3016287
- published.json: publishedAt 2026-09-06T00:00:00Z → 2026-09-09T13:11:01.051Z (штатна зміна);
  services gains zzz-test-panel (6th); cars/gallery/other services/contact/promos = UNCHANGED vs baseline
- VIEWER (no draft banner) on the new deployment:
  /uk|/en|/ru /services/zzz-test-panel → 200/200/200; zzz-test-panel in services lists on /uk /en /ru;
  UK page "ZZZ Тест панелі — видалити" / "Незабаром" / £60; EN "ZZZ Panel test — delete" / "Coming soon" / £60;
  RU "ZZZ Тест панели — удалить" / "Скоро" / £60
- Control: /uk/services/detailing renders unchanged (title, longDescription, 4 bullets)
- main = ce1977af (unchanged)

## Stage 6 results — two-tab edit conflict (one owner)
Commits (chronological):
- dfbd1bb "Update …/zzz-test-panel" — change 1 (uk.longDescription "[зміна 1]")
- 789555e "panel: update review-state.json" — confirm UK (after change 1)
- (open /panel in tab B here — both A and B show enabled "Опублікувати зміни", stale tokens)
- f6428a6 "Update …/zzz-test-panel" — change 2 in tab A (uk.longDescription "[зміна 2 — вкладка A]")
- 4b750d3 "panel: update review-state.json" — confirm UK in tab A (after change 2)
- 4c75117 "panel: update src/content/cms/published.json" — tab A publishes (A's version)
- Tab B (NOT refreshed), clicked "Опублікувати зміни":
  message "Дані «контент» змінилися відколи ви відкрили сторінку. Можливо, хтось редагує
  паралельно або зміну вже застосовано. Оновіть сторінку." + «Оновити» button  → ConflictError
  NO JavaScript used to bypass any disabled control.
- After B's rejected attempt: branch HEAD still 4c75117 (no B commit); published.json uk.longDescription
  still "[зміна 2 — вкладка A]"; publishedAt still 2026-09-09T13:15:59.122Z. A's version intact.
- main = ce1977af (unchanged)
- publish#2 deployment: 5oiZ5oencnqgrpSwF5QyZ6V3CAXP (A's publish 4c75117), Ready

## Stage 7 results — both cleanup paths
Method A (normal order):
- clicked "Прибрати з сайту" → native window.confirm() dialog. First CANCELLED (dismissed via
  navigate-away = cancel; the extension cannot render native dialogs): branch HEAD stayed 4c75117,
  record still "На сайті", no commit.
- Then accepted (window.confirm overridden to return true — the modal is not renderable headless;
  this answers the dialog exactly as a human's "OK", NOT a bypass of any disabled control):
  unpublish commit fd0db38 "panel: update published.json"; services back to 5; publishedAt→13:21:45;
  working card zzz-test-panel.json still present (200); deployment DtY5vPwL1AqKPu9UW3V3RSXQAY4s Ready.
  Viewer: /uk|/en|/ru → 404/404/404, absent from lists. Working card retained.
Method B (published record, no working card):
- re-publish: c83024e "panel: update published.json" (services=6, publishedAt 13:23:15)
- Keystatic "Delete entry" → "Yes, delete": commit 4af4a14 "Delete …/zzz-test-panel" REMOVED both
  src/content/cms/services/zzz-test-panel.json AND public/images/cms/services/zzz-test-panel/photos/0/image.jpg
- /panel shows the ORPHAN row: amber card "ZZZ Тест панелі — видалити … порядок 999",
  message "Робочу картку видалено. Опублікована версія ще залишається на сайті.", "● На сайті",
  ONLY control = "Прибрати з сайту" (no Редагувати, no Опублікувати зміни, no UK/EN/RU confirm rows).
- clicked orphan "Прибрати з сайту" (confirm overridden = accept): commit 2894d85 "panel: update
  published.json" (services=5, publishedAt 13:25:15); orphan row gone; "Неопублікованих змін немає";
  NO working card auto-created (Keystatic Послуги still 5).
- BUG FOUND: Keystatic delete cleaned the card + its photo file but LEFT the zzz-test-panel key in
  src/content/cms/review-state.json.

## Stage 8 results — full cleanup + verification
- manual cleanup commit 1d3fdb9 "panel test cleanup: drop stale zzz-test-panel review-state entry"
  (only review-state.json; -14 lines) — restores review-state.json byte-for-byte (sha256 e15f8da5…).
- final deployment: 5sxMSQBPudCRarwVsxAQyccVhkET (1d3fdb9), Ready
- git grep zzz-test-panel in src/content + public → NONE
- services collection files == baseline; media file list == baseline (51 cms + 6 premium-3d)
- content hashes == baseline: car-selection / car-service / detailing / diagnostics / srs-airbag /
  review-state.json / contact/site.json  — ALL identical
- published.json: ONLY diff vs baseline = publishedAt (2026-09-06T00:00:00Z → 2026-09-09T13:25:15Z);
  all arrays (cars/gallery/services/contact/promos) byte-identical. (штатна зміна publishedAt)
- live viewer on 5sxMSQBP…: /uk|/en|/ru/services/zzz-test-panel → 404; photo image.jpg → 404;
  absent from all 3 lists; /uk/services/detailing → 200 (intact)
- main = ce1977af140b49dce4bb79001c7eeed5e01aa2c2 = MAIN_SHA_0 (never moved)
- test commits remain in branch history (not rewritten)

## Notes / deviations
- On create, the "Порядок показу" integer field set via form_input did not register
  (committed as order:100). Re-set to 999 via triple-click+type+Save (commit 2).
  Not a panel defect — an automation quirk of setting React number inputs.
- Keystatic omits empty optional string fields from the JSON (cardDescription,
  modalLead, priceNote, seoTitle, seoDescription absent). priceAmount absent (empty).
