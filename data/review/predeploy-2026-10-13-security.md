# Pre-deployment security review — 2026-10-13

Scope: working-tree changes against Git HEAD in `api/data.js`, `assets/api.js`, `assets/admin.js`, `admin/index.html`, and surrounding Supabase migrations, Apps Script backend, public URL rendering, gallery/video code, deployment configuration. Applied the senior-security skill. Review was read-only except for this report; no deployment, remote mutation, login, or live database probe.

## Findings

### S1 — P2 / Medium: public content responses expose the last editor's email

Locations:

- `/Users/daiyazwaehama/Documents/mccmu-website/api/data.js:175` — public content queries use `select=*`; equivalent individual queries start at line 196; raw places response at line 204.
- `/Users/daiyazwaehama/Documents/mccmu-website/api/data.js:83` — content shaping spreads all database columns into the public object.
- `/Users/daiyazwaehama/Documents/mccmu-website/supabase/migrations/0003_audit_and_data_quality.sql:79` — update trigger assigns the authenticated user's email to `updated_by` on content rows.
- `/Users/daiyazwaehama/Documents/mccmu-website/supabase/migrations/0002_rls_policies.sql:36` — public SELECT policy authorizes the entire published row, without masking `updated_by`.

Trigger: an administrator edits an already published activity, document, album, place, or member. An unauthenticated reader then requests `/data?sheet=places` (or another public content endpoint), or reads the published row directly through the Supabase REST endpoint with the public anon key.

Impact: a personal administrator email intended for editing/audit history is disclosed to the public and, through the proxy, stored in public response caches. The user-facing cards do not need this field. The restricted audit-log table does not prevent the content-row copy from being read.

Validation: executed the actual edge handler in Node with a mocked fetch response containing `updated_by: 'editor@example.test'`. The unauthenticated places response returned that exact field with status 200 and `Cache-Control: public, max-age=120, s-maxage=180, stale-while-revalidate=60`. The trigger and RLS behavior were traced in the checked-in migrations. No personal production email was requested or printed.

Remediation: expose only intended public content fields through the proxy AND the database public read interface. Merely deleting the field from proxy JSON leaves direct REST disclosure possible. Existing private `audit_log.actor` already supplies administrator attribution; consider keeping personal attribution there rather than on publicly selectable rows, or separating public content into a restricted view/RPC with appropriate table/column grants.

Baseline: this defect already exists in Git HEAD. Current changes preserve it; it is not a new preview regression. Production schema and existing `updated_by` values were not verified.

### S2 — P2 / Medium: the legacy Sheets path allows unauthenticated reads of draft/archived rows

Locations:

- `/Users/daiyazwaehama/Documents/mccmu-website/api/data.js:57` — passes the complete user-controlled query to Apps Script and publicly caches the response.
- `/Users/daiyazwaehama/Documents/mccmu-website/api/data.js:299` and `:313` — a public `src=sheets` parameter can select the legacy source even when deployment uses Supabase.
- `/Users/daiyazwaehama/Documents/mccmu-website/backend/Code.gs:120` — filters by the caller's status rather than forcing `published`.
- `/Users/daiyazwaehama/Documents/mccmu-website/backend/Code.gs:176` — accepts that status parameter without authentication; analogous docs/albums/places/members paths also do so.
- `/Users/daiyazwaehama/Documents/mccmu-website/assets/api.js:92` — the Apps Script URL is also used directly as a public fallback.

Trigger: any legacy Sheets content row has `status='draft'` or `status='archived'`. A reader requests `/data?sheet=places&src=sheets&status=draft`, or calls the public Apps Script URL directly with equivalent parameters.

Impact: legacy unpublished content can be returned without administrator authentication and publicly cached. Switching the main data source to Supabase or protecting only the new `preview=1` branch does not protect these legacy rows. This does NOT demonstrate exposure of Supabase-only drafts: the two data stores are separate.

Validation: executed the actual edge handler with mocked Apps Script fetch. The unauthenticated request forwarded `status=draft` unchanged and returned the draft fixture with status 200 and public cache headers. Separately evaluated the actual `byStatus` function from `backend/Code.gs`; passing `'draft'` selected the draft fixture. No live drafts were queried.

Remediation: force `published` in the public Apps Script backend, and normalize/reject unpublished statuses in the proxy's Sheets path. Updating only the proxy leaves the publicly known Apps Script URL callable directly. If archived content is deliberately public, document that contract explicitly; otherwise archive must remove it from public retrieval.

Baseline: this defect already exists in Git HEAD and the unchanged backend. No assertion is made that current production Sheets contains any private draft/archived row or that its deployed Apps Script matches this source.

## Changes checked without a confirmed security regression

- Preview requests require a Bearer-shaped token, pass that token to Supabase, and rely on database RLS for cryptographic validation and administrator authorization. A JWT-shaped token is not itself authorization.
- A controlled handler run with `Bearer a.b.c` confirmed the forwarded token, the `status=in.(published,draft)` filter, and `Cache-Control: private, no-store`. Missing Authorization returned 401 with `no-store`. Because upstream fetch was mocked, this does not claim that an invalid token is accepted by real Supabase.
- Preview combined-data loading bypasses public localStorage caches and does not write preview results there. Album preview bypasses sessionStorage caching and does not write preview metadata there.
- Checked-in RLS policies limit anonymous/non-admin content reads to published rows, album-photo reads to published parents, and admin-list writes to owner. Live migration installation and live grants remain unverified.
- Administrator UI constructs data text with `textContent`. SVG parsing uses fixed markup, and preview navigation targets fixed relative pages.
- Place map links require HTTPS; embedded place maps use a fixed Google Maps origin and encoded query. Contact/halal map iframe values require HTTPS. Gallery media rejects non-HTTPS URLs. YouTube IDs are constrained to 11 allowed characters before constructing embed URLs.
- A targeted scan for service-role keys, private-key markers, GitHub tokens, and AWS access-key markers found references in instructions/comments rather than an exposed privileged credential. The checked-in browser Supabase JWT has role `anon`; its public presence is not a secret leak by itself.
- `git diff --check` passed at the time of review.

## Limits and deployment assessment

No newly introduced auth/cache security defect was confirmed in the reviewed diff. S1 and S2 are actionable existing confidentiality issues and should be resolved or explicitly assessed before production. This is not a full penetration test: no live RLS/authentication, owner/editor workflow, database grants, deployment environment, server headers, or external CDN integrity was validated. External scripts were not downloaded/executed. No speculative XSS claim is made from raw link assignment alone; URL settings accept arbitrary values and would benefit from an HTTPS/domain contract, but an actual executable payload was not reproduced in this review.
