# Focused administrator functional review — 2026-10-13

Scope: the current working-tree administrator form/list/album editor and preview flows. Read `.claude/audit/AUDIT_BRIEF.md`, actual `assets/admin.js`, mock client, and relevant public preview code. No application source edits, real sign-in, database writes, deployment, or push.

## Confirmed findings

### A1 — P2 / Medium: save and preview can insert the same new record twice

Location: `/Users/daiyazwaehama/Documents/mccmu-website/assets/admin.js:1459`, `:1481`, `:1483`, `:1496`, and `:1453`.

Steps:

1. Open a new place/activity/document/album/member form and fill required fields.
2. Click the ordinary save button.
3. While the request is pending, click **บันทึกและดูตัวอย่าง**, or use Ctrl/Cmd+S again.

Observed execution: the save function disables only the clicked button. The other save button remains enabled, and the keyboard handler calls `submit(false)` without checking any in-flight state. `isNew` stays true until the first insert response returns. The second submission therefore sends another INSERT of the same payload; database content primary keys are generated independently, so no uniqueness constraint on the name prevents duplicates.

Reproduction used the actual `segmented()` and `openForm()` source in Node with a minimal DOM and deferred in-memory database responses. Output:

```json
{"afterSave":{"saveDisabled":true,"previewDisabled":false,"calls":1}}
{"afterPreview":{"calls":[{"table":"places","payload":{"status":"draft","name":"New place"}},{"table":"places","payload":{"status":"draft","name":"New place"}}],"pending":2}}
```

Impact: accidental duplicate content while saving on a slow connection; repeated updates are also possible on existing rows. This is a new path in the redesigned form because the second save/preview action was added.

Fix: use one shared `submitting` guard at the top of `submit()` covering both buttons and the keyboard shortcut; disable both buttons until the request finishes, with cleanup in `finally`.

### A2 — P2 / Medium: editing during preview-save silently loses the dirty-state warning

Location: `/Users/daiyazwaehama/Documents/mccmu-website/assets/admin.js:1473`, `:1481`, `:1497`, `:1439`, and `:1446`.

Steps:

1. Enter **Saved name**, then click **บันทึกและดูตัวอย่าง**.
2. Before the save response arrives, change the name to **Later unsaved edit**.
3. After the response arrives, close the still-open form.

Observed execution: editable inputs remain enabled during the request. The payload captures **Saved name** before the await. The later edit changes the input but the already dirty form does not track a new edit generation. The successful response unconditionally sets `dirty=false` and shows **บันทึกแล้ว**. Closing the form no longer asks to discard the later unsaved edit.

Actual-source Node execution with a deferred in-memory save produced:

```json
{"beforeResponse":{"lastPayload":{"status":"draft","name":"Saved name"},"input":"Later unsaved edit"}}
{"afterClose":{"input":"Later unsaved edit","confirmations":[],"closes":["closed"]}}
```

Impact: an administrator loses changes entered during a slow preview-save even though the editor shows a successful saved state. Ordinary save closes the panel after success and can similarly discard an edit typed during the request.

Fix: disable editable controls during save, or track an edit revision and clear dirty state only when the current revision equals the revision captured in the saved payload. Keep later edits marked unsaved.

## Reviewed paths and limits

- List query order, text search, status/pinned filters, and form required-field checks were traced in actual source. Save payload normalization, insert-to-update transition after success, and explicit database-error toast handling were reviewed.
- Album-photo loading, adding unique pasted Drive IDs, folder-import error/finally handling, ordering swap, removal, and cover update were reviewed. No additional new, concrete album bug confirmed in this focused pass. Those asynchronous album controls are not fully concurrency-tested.
- Preview destinations are fixed by table; saved preview keeps the form open, and a blocked popup falls back to a toast link. Authentication and public-preview caching are covered in the separate security report.
- UI testing was unavailable: CUA `createBrowserTab('iab', ...)` returned **Browser is not available: iab**; `cua.getState()` returned `browsers: []`. Starting the isolated local server on port 8905 returned **listen EPERM: operation not permitted 0.0.0.0:8905**. No server started and no browser/localStorage state was changed.
- Deterministic tests execute actual application functions with lightweight DOM and in-memory database fixtures. They verify the relevant event/request/state behavior; they do not verify layout, popup browser policy, Google OAuth, real Supabase SDK behavior, RLS, or real folder imports. The test harness remains outside the project at `/private/tmp/mccmu-admin-submit-check.mjs` and is not deployment source.
