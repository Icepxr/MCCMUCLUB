# Public frontend pre-deploy audit — 13 October 2026

Scope: current working tree, changed public HTML/API/i18n and new gallery/videos components. Read-only audit using senior-frontend guidance; no application edits, live writes, push or deployment. Admin/security/data are reviewed separately.

## Findings

### P2 — Today's prayer date can show an older day's prayer schedule

- Verified locations: `/Users/daiyazwaehama/Documents/mccmu-website/assets/api.js:1032`–`:1034` (stale fallback), `:968`–`:970` (date label), `:994`–`:1026` (timer).
- Reproduced with an isolated Node VM executing the actual `renderPrayerStrip` implementation and small DOM stubs, fixed Bangkok clock and deterministic API responses. No browser/network data was modified.
- Scenario A: set clock to 13 October 2026, provide cached prayer `date: "12 Oct 2026"`, then reject the new `13-10-2026` request. The catch returns yesterday's response and the renderer draws its five times beneath “13 ต.ค. 2569”, with a normal countdown and no stale/error indication.
- Scenario B: load at 23:59 Bangkok on 13 October, then advance clock to 00:01 on 14 October and invoke the registered timer. Label remains “วันอังคารที่ 13 ต.ค. 2569”; only the countdown changes from tomorrow Fajr to Fajr. Calls remain `["all"]`: neither date/Hijri nor schedule refreshes. The timer closes over the original day's list.
- Impact: visitors can act on an old timetable presented as current, especially during a failed refresh or a tab left open overnight.
- Suggested fix: verify returned date before showing prayer data; fail visibly instead of silently accepting an older day. On Bangkok day rollover (including returning to a background tab), refresh the date, Hijri and prayer list. After Isha, use tomorrow's Fajr for its countdown or clearly qualify the estimate.
- Validation needed after fix: yesterday cache + failed fetch; Bangkok midnight crossing; tab resumed the next day; tomorrow Fajr differs from today's.

### P3 — Keyboard focus is discarded when starting a video

- Verified location: `/Users/daiyazwaehama/Documents/mccmu-website/assets/videos.js:119`–`:127`.
- Browser reproduction: at `/knowledge#videos`, focus the poster “Play video: นักศึกษามุสลิมกับชีวิตในรั้วมหาวิทยาลัย” and press Enter. The poster is replaced by the iframe; immediately afterwards `document.activeElement.tagName === "BODY"`. Accessibility snapshot also reports the page root as focused rather than the player.
- Impact: keyboard/screen-reader visitors lose the control they just activated and receive no deliberate focus handoff to the replacement player.
- Suggested fix: explicitly move focus to the iframe/player when activation removed the currently focused poster. Keep side-list selection focus deliberate and predictable.
- Validation needed: Enter/Space activation, then keyboard access to playback controls and subsequent playlist items.

### P3 — Past featured activity is labelled upcoming (existing issue)

- Verified locations: `/Users/daiyazwaehama/Documents/mccmu-website/activities.html:41` and `:53`.
- Browser reproduction on 13 October 2026: `/activities` displays the 11 October 2026 activity beneath both “Upcoming featured events” labels. The homepage correctly labels this same fallback activity “Most recent past event”.
- This is pre-existing markup, not a regression introduced by the current gallery change.
- Suggested fix: apply the same dynamic past/upcoming heading/status handling to the activities page, or hide the upcoming feature when no future event exists.

## Verified working

- Existing local Vercel-like audit server at `http://localhost:8904`; public anonymous read requests only. No new server was started.
- Gallery rendered seven real albums at desktop 1280 × 900 (three columns), phone 375 × 812 and activities phone 320 × 740. Measured document width never exceeded viewport width in these checks.
- Opened 154-photo album on phone; overview, photo selection, next-photo navigation, close and focus return to the originating album card worked. Full image for the next photo loaded successfully. Dialog measured 375px wide at 375px viewport.
- `/knowledge` loaded three YouTube items. User activation produced a functioning `youtube-nocookie.com` player, without error 153; iframe accessibility exposed video title, duration and playback controls.
- Thai/English navigation, new gallery labels, document dates, homepage prayer date/Hijri/countdown and video section controls rendered. Video metadata in combined speaker/date rows remains Thai, a low-priority translation completeness gap.
- Static parser checked local `href`/`src` targets in every root HTML page; no missing local target was found. Browser logs on knowledge before playback contained no captured warning/error.
- Temporary viewport override reset; audit tab closed after testing.

## Rollout concern (inferred; not simulated in browser)

`/Users/daiyazwaehama/Documents/mccmu-website/vercel.json:18` caches unchanged CSS/JS URLs for 600 seconds and permits stale use for 604800 seconds. New activities markup removes the old gallery lightbox, so mixing new HTML with cached old `api.js` is worth testing/versioning before release. This is shared with the coordinating agent for the deployment audit, not asserted as a reproduced live failure.

## Limits

No production deployment checked, no authenticated preview/admin workflow tested, no automated WCAG/contrast scan or real screen-reader/device lab used, no external links exhaustively crawled. Midnight/offline prayer failures were deterministic implementation tests, not wall-clock browser sessions. Breakpoint coverage is sampled rather than exhaustive. Successful current anonymous API reads do not establish that approved restaurant records are imported. This report is not a deploy approval.
