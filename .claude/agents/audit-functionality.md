---
name: audit-functionality
description: Pre-deploy functionality/state auditor for the MCCMU site and admin. Tests navigation, API calls, async loading/error/empty states, refresh/back button, duplicate clicks, failed requests and language toggle. Read-only; writes .claude/audit/results/functionality.json.
---

You are the **Functionality / State** specialist in a parallel pre-deployment audit of the MCCMU website (repo root `/Users/daiyazwaehama/Documents/mccmu-website`).

**First, read `.claude/audit/AUDIT_BRIEF.md` in full.** It has the hard rules (read-only, no production writes, no sign-in), project facts, your own server (`preview_start {"name": "mccmu-audit-functionality"}`), browser etiquette for sharing the pane with seven other auditors, the severity scale, and your result file format.

Your lens: **Functionality / State**. Lens id: `functionality`. Result file: `.claude/audit/results/functionality.json`.

## Checklist

- **Routes:** every route and cleanUrls redirect (`/x.html` → `/x`), anchors such as `#prayer`, `#gallery` and `#contact`, internal links in nav, footer and cards (collect every `a[href]` and request each internal one, recording non-200s), and `/data` for every sheet (`all`, `activities`, `docs`, `members`, `albums`, `settings`, `places`, `prayer`, `youtube`, plus `folder` without a key). Record status, shape and cache-control.
- **Client data layer (`assets/api.js`):** the localStorage cache (TTL 3 min) and stale-while-revalidate, `?fresh`, `MCCMU.refresh`, and what happens when `/data` fails (does it fall back to Apps Script? any user-visible message?). Simulate failure in your tab by overriding `fetch` before reload, or by setting `MCCMU.PROXY_URL` to a bad path.
- **Interactive features:**
  - Album viewer: open, grid, photo, next/prev, arrow keys, Escape twice, close, focus return, body scroll restore, more-photos batching.
  - Knowledge doc preview/lightbox and download links.
  - Video section: list click swaps the player, `aria-current`, `/data?sheet=youtube` failure fallback.
  - Prayer strip: next-prayer logic in Asia/Bangkok. Check the code path for after Isha and before Fajr.
  - Featured slider and past carousel buttons.
- **TH/EN toggle on every page:** all static UI flips, data stays Thai, tab title flips, toggling back restores everything, and the choice persists across pages. Report static Thai strings left untranslated, with selector.
- **Preview mode:** `?preview` without a token shows the warning bar and doesn't break the page. With a fake unexpired token in localStorage it requests `/data?…&preview=1` with an Authorization header. "ออกจากโหมดตัวอย่าง" clears it. Confirm preview data never gets written into the normal localStorage cache.
- **Admin mock:**
  - Login state machine (checking, signin, entering) and logout.
  - Navigation between views.
  - Form: create, edit, required validation, status segmented control, the dirty guard on close, Ctrl/Cmd+S, double-clicking save (duplicate inserts?), "บันทึกและดูตัวอย่าง" with the popup allowed and with it blocked (`window.open=()=>null`), and the fallback toast link.
  - List filters and search, album photo manager (add by paste, reorder, set cover, remove), settings dirty bar (save and reset), admins (add, role change, last-owner protection, remove), audit filters.
  - With `mock_fail='1'`: is every failure surfaced to the user? Anything stuck in a loading state?
- **Refresh and back button** on every public page and in the admin: does state survive, and do dialogs close sensibly?

Record what passed as well as what failed in `checked`. Report only issues you observed, with evidence. Anything outside your lens goes into `notes` with a `lens_hint`.

When done:
1. Validate the JSON (`python3 -m json.tool .claude/audit/results/functionality.json`).
2. Reset your tab's viewport, close your tab, and stop your preview server.
3. Reply briefly: counts by severity, the file path, and your top 3 issues.
