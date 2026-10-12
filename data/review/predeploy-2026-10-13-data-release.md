# MCCMU predeployment review — data and release

Reviewed 13 October 2026, Asia/Bangkok. Scope: approved 11 restaurants, import SQL, public data path, static deployment exposure and release compatibility. Read-only audit; no database writes, application changes, pushes or deployment performed by this reviewer.

## Actual production status

Public GET `https://mccmuclub.vercel.app/data?sheet=all` returned HTTP 200, `source: supabase`, **29 places / 23 restaurants**. GET `/data?sheet=places` returned the same 29 published records. All 11 UUIDs in `data/import/chiang-mai-halal-2026-10-13.json` occur exactly once and all approved import fields match live records, normalizing empty coordinates to SQL NULL. The 18-place/12-restaurant count refers to the original dataset, not current production. Do not repeat the import merely because an earlier chat said it had not run.

The current production `/assets/api.js` is byte-for-byte equal to `git show HEAD:assets/api.js`, with actual response `Cache-Control: public, max-age=600, stale-while-revalidate=604800`. Pending working-tree application changes have not been verified in a Vercel Preview deployment.

## Findings

### P1 — Version changed assets before publishing incompatible gallery markup

Evidence: `activities.html:19` retains the unversioned `assets/api.js` URL; `activities.html:95` introduces the new album grid and removes the old `#lb`/`#lbImg` overlay. `vercel.json:18` allows cached JavaScript for 600 seconds plus stale reuse while revalidating for seven days. The new delegation in `assets/api.js:687` exists only in the new script, so browsers retaining the currently deployed script cannot use the new gallery implementation.

Reproduction: evaluated the currently deployed/HEAD `MCCMU.renderGallery` function against a minimal DOM corresponding to current activities markup (no `#lbImg`), with one album/photo and the new `window.MCCMUGallery` present. Clicking the album raises `TypeError: Cannot read properties of null (reading 'classList')`; the old function ignores the new gallery module. `assets/gallery.js:298` only exposes `mount`; it does not independently mount the gallery and rescue this combination. New CSS/API/home prayer markup also needs coherent asset versions.

Required release fix: use a release version/hash in changed CSS/JS URLs consistently across affected pages, or retain full backward-compatible markup until the cached assets expire. Recheck new HTML with both warm and cold browser caches before real deployment. This blocks publishing the current incompatible HTML/JS combination.

### P2 — Source, SQL and full backup artifacts are publicly served

Observed public HTTP 200: `/data/backup/places.json`, `/data/backup/activities.json`, `/data/backup/members.json`, `/data/backup/albums.json`, `/data/backup/settings.json`, `/supabase/seed/parts/places.sql`, `/supabase/migrations/0006_admin_roles.sql`, `/scripts/backup-data.sh`, `/AGENTS.md`, `/MIGRATION-VERCEL.md`.

Evidence: `MIGRATION-VERCEL.md:35` through `:38` documents serving the repository root without a build/output directory; `vercel.json:5` contains only the `/data` rewrite and no private-file restrictions; `.gitignore:16` through `:29` do not exclude data/SQL/dev directories. `.gitignore` alone is also not a deployment allowlist for tracked files.

Actual severity: sampled live activity/member/album backups contain only published records; settings contain public website configuration. No private credentials or private records were demonstrated in this audit, and SQL/schema exposure is not by itself a database authorization bypass. Nevertheless, `scripts/backup-data.sh:34`–`:35` backs up published AND archived content, so future archived records could be published through static files independently of Supabase RLS. Exclude backups, SQL, scripts, review/import and developer fixtures from the production output.

Observed HTTP 404 for current `/data/import/chiang-mai-halal-2026-10-13.json`, `/data/review/chiang-mai-halal-2026-10-12.json`, `/supabase/seed/halal-restaurants-2026-10-13.sql`, `/.claude/launch.json`, `/.claude/audit/admin-mock.html`, `/.claude/audit/mock-supabase.js`. These new files are not currently exposed; their safety in the next deployment is unverified. `.claude/audit/mock-supabase.js:1`–`:2` explicitly implements fake in-memory writes, and `admin-mock.html:10` replaces the Supabase client with that fixture; this is not a demonstrated production login/RLS bypass.

### P2 — Operational backups still use the previous Sheets source

Evidence: `.github/workflows/backup-data.yml:24`–`:25` runs `scripts/backup-data.sh`; that script `:19` finds the Apps Script URL from frontend source and `:34`–`:35` fetches Sheets data. `data/backup/_meta.json:7` lists 18 places, and `:10`–`:11` records an August 2026 Google Sheets snapshot. Current production is Supabase with 29 places. Restoring these backups as the current source would omit the approved 11 restaurants and any later Supabase edits. Confirm a current Supabase backup/recovery path; do not present this old backup pipeline as protection for the active database.

### P2 — Ten new embedded maps infer locations only from the restaurant name

Evidence: `data/import/chiang-mai-halal-2026-10-13.json` contains empty `coords` for entries 1–10 and verified coordinates for entry 11 (`:97`). Their outbound `map_url` searches include available addresses, but `assets/api.js:829`–`:832` generates the embedded card map from only name + Chiang Mai when coordinates are absent, ignoring address information in the search link. Ambiguous names can therefore show a different location inside the card than the outbound map search. This matters particularly for the several similarly named ข้าวซอยอิสลาม entries.

User approval of all 11 is recorded and respected. This is a location-accuracy limitation, not a renewed approval request. Prefer showing only the approved outbound search link when an exact location is unknown, or label inferred location appropriately; add verified coordinates when available. Owner opening hours/current certification remain unverified research limitations, as stated in `data/review/chiang-mai-halal-2026-10-12.md:9`.

### P3 — Review status documents are inconsistent with live publication

`data/review/chiang-mai-halal-2026-10-12.md:5` still says no database write/publication verification; JSON `:6`–`:7` says written/deployed, while `:562` says `publication_verified: false`. Nested review records retain draft snapshots, whereas import files intentionally publish them. Keep snapshots clearly labeled, update the actual verification metadata and distinguish publication of data from deployment of application code.

## Import correctness and integration

- JSON contains 11 rows with 11 valid, unique UUIDs and names; every map URL is HTTPS. UTF-8-BOM-aware CSV parsing yields the exact JSON fields/values. SQL embedded JSON is byte-content-equivalent as parsed data.
- Fields match `public.places` (`supabase/migrations/0001_initial_schema.sql:77`–`:86`), status enum (`:14`) and place type enum (`supabase/migrations/0003_audit_and_data_quality.sql:98`–`:99`). Empty coordinates become NULL (`supabase/seed/halal-restaurants-2026-10-13.sql:13`).
- SQL uses BEGIN/COMMIT, a transaction-local temporary table and `SHARE ROW EXCLUSIVE` lock (`:18`). Insertion excludes existing UUID, normalized name or map URL (`:23`–`:28`) and verifies exact published field values before commit (`:31`–`:45`). A mismatched or unpublished collision raises and rolls back the batch. Exact replay skips the existing rows and passes verification; no UPDATE/DELETE occurs. A matching existing row with a different UUID is intentionally accepted by the field-based verifier. No PostgreSQL execution or live write/RLS mutation was performed during this audit.
- Anon public read is restricted to published rows in the intended migration (`supabase/migrations/0002_rls_policies.sql:36`–`:38`); authenticated writes require `private.is_admin()` (`:44`–`:46`). An HTTP public GET cannot prove live policy definitions or mutation denial; the security reviewer should verify deployed RLS without writing records.
- Frontend reads `/data` (`assets/api.js:18`) through the Vercel `/api/data` rewrite (`vercel.json:6`). The Supabase branch fetches published places (`api/data.js:168`, `:177`, `:201`–`:204`). `assets/api.js:922`–`:927` renders restaurants based on type without a cap, so all 23 can appear in the carousel. The large top map is separately configured (`assets/api.js:889`), so adding places does not edit its Google My Maps pins automatically.
- LocalStorage stale data can be displayed on the first return visit (`assets/api.js:139`–`:144`) while refreshing for the next load. `?fresh` bypasses that browser data cache (`:130`); it does not invalidate the JavaScript URL cache or all edge caches. Public network responses prove the data is live; they do not prove every existing browser has refreshed.
- If the proxy fails, `assets/api.js:91`–`:92` falls back to the old Sheets source, which can temporarily omit Supabase-only restaurants. Track this as a recovery limitation when validating failure states.

## Review verdict

Data import itself is already present in production and matches the approved set. Do not perform another database import as part of this audit. Block the pending application deployment on the confirmed mixed-version gallery break. Remove nonpublic artifacts from the deployment output and validate a real Preview deployment, including warm-cache navigation, before publishing the current working-tree application changes.

Limitations: read-only public HTTP + static/mixed-version function review; no authenticated admin session, live SQL console, Vercel project settings/build artifact inventory or browser walkthrough by this reviewer. Other agents cover application security and frontend/browser behavior.
