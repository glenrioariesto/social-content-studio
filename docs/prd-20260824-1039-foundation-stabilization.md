## PRD: Social Content Studio — Foundation Stabilization

## 1. Product overview

### 1.1 Document title and version

- PRD: Social Content Studio — Foundation Stabilization
- Version: 1.0

### 1.2 Product summary

Social Content Studio is a local-first Electron desktop application used by a solo creator to manage multiple social-media brands: accounts, HTML content templates, media assets, and FFmpeg-rendered vertical videos. Content is stored as human-readable JSON under a single `workspace/` folder, and publishing to platforms remains a deliberate manual step.

This development cycle focuses on **stabilizing the foundation** rather than adding features. The Discovery analysis (see `docs/discovery-draft-20260824-1033-social-content-studio.md`) identified concrete risks in the persistence and security layer: content items can silently overwrite each other due to unstable identifiers, renderer-exposed filesystem operations are not confined to the workspace, corrupted data files fail silently instead of surfacing errors, a visible workspace setting has no effect, and the project has no automated tests to protect against regressions.

The business thesis behind this cycle is **production-time efficiency through reliability**: every lost render, silently overwritten content, or mysterious failure costs the operator rework time. A pipeline the operator can trust removes those hidden time taxes, which directly increases weekly output per brand without changing how the product is used day to day.

## 2. Goals

### 2.1 Business goals

- Eliminate silent data loss incidents (overwritten or corrupted content) that force manual rework.
- Reduce average time-to-produce one ready-to-post video per brand by removing reliability-related rework and debugging.
- Establish an automated quality gate so future feature cycles can ship faster with lower regression risk.
- Keep all brand assets recoverable and inspectable on local disk.

### 2.2 User goals

- As the operator, I never lose or unknowingly overwrite any content item, template, or account configuration.
- When something fails (missing FFmpeg, corrupted file, deleted folder), I see a clear, actionable error instead of silence.
- Settings I can see in the UI do exactly what they claim to do.
- My existing workflow (create → compose → render → mark posted) feels unchanged and at least as fast as before.

### 2.3 Non-goals (Out of Scope)

- Platform API integrations or automated publishing (manual publishing boundary stays).
- Scheduled publishing or any `scheduled` status concept.
- New render presets (no landscape YouTube preset), no changes to preset resolutions.
- HTML-to-video frame capture (no Playwright/Chromium introduction this cycle).
- Multi-user support, collaboration, or cloud sync.
- Migrating storage away from JSON files to a database.

## 3. User personas

### 3.1 Key user types

- Solo Content Operator (primary and only in-scope user type)

### 3.2 Basic persona details

- **Glen (Solo Content Operator)**: Technical solo creator running three active brands (`glen-rio-aristo`, `highproduct`, `jacksonlab`) from one Windows machine. Produces short-form vertical video per brand on a weekly cadence. Values speed, keyboard-efficient flows, and absolute trust that finished work is never lost. Comfortable reading error logs but should not need to.

### 3.3 Role-based access

- **Local Operator**: Full control of all features and data. There are no in-app roles or accounts; OS-level file permissions govern disk access. The app must assume anyone at the keyboard is authorized.

## 4. Functional requirements

- **Unique durable content identifiers** (Priority: High)
  - Creating a content item always produces an identifier that has never been used for a different content item in the same workspace, regardless of prior deletions or concurrent creation attempts.
  - Saving a content item must never write into another existing content item's folder.
  - Existing seeded workspaces remain readable; only new creation behavior changes.

- **Workspace-confined filesystem operations** (Priority: High)
  - All file/directory operations exposed to the app UI operate strictly inside the configured workspace folder.
  - Any attempt to read/write/delete outside the workspace is refused with a clear, user-visible error naming the offending path.
  - Legitimate current behaviors (template editing, asset browsing, backup export/import destination choice) continue to work within their documented boundaries.

- **Validated, honest persistence** (Priority: High)
  - Reading any persisted document (content, template, account) checks it against its known required fields; documents failing validation surface a visible error state identifying the offending file, rather than rendering fabricated defaults.
  - Writing merges only known, permitted fields for that document type.
  - The queue/logs views make every validation failure inspectable after it happens.

- **Effective workspace settings** (Priority: Medium)
  - The workspace folder shown in Settings is the folder the app actually uses, including after an app restart.
  - If switching workspace requires an app restart to take effect, the UI says so explicitly at the moment of change.
  - Invalid or missing workspace folders produce a first-run-style setup state, never a blank broken app.

- **Automated test harness** (Priority: High)
  - The repository contains a runnable test suite executed with a single standard command, covering at minimum: identifier uniqueness, path confinement refusal, and persistence validation (read/write/corrupt-file cases).
  - Running the suite plus typecheck constitutes the merge gate for this cycle's changes.

- **Consistent visible async states** (Priority: Medium)
  - Every asynchronous screen action presents loading, empty, error, and success states; no operation ends in silent nothing.
  - Destructive actions (delete content/template) require explicit confirmation and report success or failure.

- **Lifecycle transition integrity** (Priority: Medium)
  - Status changes offered in the UI follow the defined content status flow; illegal transitions are not offered, and any rejected transition surfaces an explanatory error.
  - Render-driven transitions (rendering → ready-to-post / failed) remain automatic and inspectable in the queue view.

- **Hardened renderer defaults** (Priority: Low)
  - The renderer process runs with the strictest Electron security defaults compatible with the current preload bridge; any relaxation that remains is documented in the architecture doc with its reason.

## 5. User experience

### 5.1 Entry points & first-time user flow

- App launch lands on the Dashboard; if the configured workspace is missing or invalid, the app shows a guided setup state instead of broken pages.
- Settings page exposes workspace folder and FFmpeg location with immediate validity feedback ("folder exists / FFmpeg found").
- Queue page doubles as the health view: failed jobs, validation failures, and logs are reachable from there.

### 5.2 Core experience

- **Create content**: operator picks account (+ optional template), names the item, and lands in the content detail — confident the new item is distinct from everything prior.
- **Compose & preview**: template variables edited with live HTML preview, unchanged from today.
- **Render**: enqueue to the vertical-video presets; progress, completion, and failure are always visible; retry is one click.
- **Finish manually**: copy caption/export/open output folder/mark as posted — the existing manual publishing flow.

### 5.3 UI/UX highlights & Edge cases

- Corrupt or hand-edited JSON file: affected list shows a clearly marked broken entry with the file path and an "open logs" affordance; the rest of the list still loads.
- Workspace folder removed while app is open: watcher reports the loss; destructive operations disable themselves until the folder returns or a new workspace is chosen.
- Duplicate-prone legacy IDs from older workspaces: app detects collisions on load and flags them for attention without destroying anything.
- Long-running renders during shutdown: app warns before quitting with jobs in flight.
- Every error toast carries enough context (file/channel) to act on without opening devtools.

## 6. Narrative

Glen sits down on Monday morning to produce this week's videos for three brands. He opens Social Content Studio, creates six content items across his accounts, fills template variables, and enqueues renders — trusting that each item is safely its own record and nothing can clobber yesterday's finished work. One template JSON he tweaked by hand last night has a typo; instead of a mysteriously empty templates list, the page shows exactly which file is broken, and everything else keeps working. A render fails because FFmpeg was moved; the queue tells him plainly, he points Settings at the new location, hits retry, and moves on. By lunch, all six videos are rendered, exported, and marked posted — with zero minutes spent re-creating lost work or guessing what went wrong. That absence of invisible friction is the product outcome this cycle purchases.

## 7. Success metrics

### 7.1 User-centric metrics

- Zero silent data-loss incidents over 4 weeks of real use (self-reported + log evidence).
- Median operator-visible time from "create content" to "enqueued render" does not regress vs. pre-stabilization baseline.
- Every failure encountered in normal use has a visible, actionable message (target: 100% of logged errors traceable to a user-visible event).

### 7.2 Business metrics

- Weekly ready-to-post videos shipped per brand meets the operator's cadence target without weekend catch-up sessions.
- Rework time (recreating lost/corrupted content, debugging silent failures) drops to ~0 minutes/week.

### 7.3 Technical metrics

- Test suite covers identifier uniqueness, path confinement, and persistence validation, and runs green via one command.
- `bun run typecheck` and `bun run build` pass on every merge.
- Zero occurrences of content-ID reuse recorded in logs after the change ships.
- All filesystem IPC refusals outside-workspace are logged and reviewable.

## 8. Technical considerations (Input for Engineering Team)

### 8.1 Integration points

- Persistence layer: content/account/template CRUD handlers under `src/main/ipc/filesystem.ts`; shared contracts in `packages/shared/src/` remain the source of truth for validation rules.
- Preload bridge surface (`src/preload/index.ts`) and its typed declaration (`src/renderer/src/lib/electron.d.ts`) must stay synchronized with any handler changes.
- Watcher service and render queue events feed the UI states described above; failure events must reach the queue/logs views.

### 8.2 Data storage & privacy

- File-backed JSON under `workspace/` remains the only store; no database, no network sync.
- Validation belongs in the main process at read/write boundaries; the workspace layout (`accounts/`, `templates/`, `contents/`, `assets/`, `config/settings.json`) is preserved.
- Backup/export-import flow must round-trip validated data; consider validating on import too.

### 8.3 Scalability & potential technical challenges

- Identifier strategy must hold up as `contents/` grows into hundreds of folders and under rapid sequential creates.
- Path confinement must handle Windows specifics (drive-relative paths, case-insensitivity, symlinks if ever introduced) without breaking template editing or backup destinations.
- Enabling stricter Electron sandbox may require preload adjustments; verify the bridge contract survives before committing to it.
- Test harness selection should fit Bun + electron-vite tooling already present and not require a build system rewrite.

## 9. Milestones & sequencing

### 9.1 Project estimate & Team composition

- Size: M (~2–3 weeks elapsed) | Team: solo developer working with AI agent assistants (SDLC pipeline)

### 9.2 Suggested phases

- **Phase 1**: Quality gate foundation — introduce test harness; codify current persistence behavior as regression tests (≈3 days)
- **Phase 2**: Data integrity — durable unique identifiers + schema-validated reads/writes + visible corruption handling (≈4 days)
- **Phase 3**: Security confinement — workspace-scoped filesystem IPC with clear refusals; effective/honest workspace settings (≈4 days)
- **Phase 4**: UX reliability — universal loading/empty/error states, lifecycle transition guards, hardened renderer defaults where feasible (≈3–4 days)
- **Phase 5**: Hardening pass — real-use soak test across all brands, documentation updates, backlog sweep (≈2 days)

## 10. User stories & Acceptance Criteria

### 10.1. Distinct content records

- **ID**: GH-001
- **Story**: As a Solo Content Operator, I want every newly created content item to be guaranteed unique and permanent, so that creating or deleting other items can never overwrite my existing work.
- **Acceptance criteria**:
  - [ ] Creating 10 content items sequentially yields 10 coexisting, individually editable records.
  - [ ] Deleting one item and creating a new one produces an ID that differs from the deleted one; the new record never appears inside a reused folder containing old data.
  - [ ] Rapid successive creations (≥5 within one second) all persist as separate records.
  - [ ] An attempt to create when the workspace is unwritable shows a visible error and creates nothing partial.

### 10.2. Confined filesystem access

- **ID**: GH-002
- **Story**: As a Solo Content Operator, I want the app's file operations restricted to my workspace, so that no bug or compromised dependency can touch files elsewhere on my machine.
- **Acceptance criteria**:
  - [ ] Read/write/delete/mkdir/list requests targeting paths outside the workspace are refused and show an error naming the requested path.
  - [ ] All currently shipped features (template editing, assets browsing, backup export/import, resource download) still function within their documented scopes.
  - [ ] Each refusal is recorded in the app logs with channel and path.
  - [ ] Windows edge inputs (`..` traversal segments, drive-letter absolute paths) are refused identically.

### 10.3. Honest handling of corrupt data

- **ID**: GH-003
- **Story**: As a Solo Content Operator, I want invalid saved data to be visibly flagged with its file path, so that I can fix or remove it instead of discovering silent gaps later.
- **Acceptance criteria**:
  - [ ] A content/template/account JSON failing field validation renders as a distinct broken-entry card showing the file path, without preventing other entries from loading.
  - [ ] No default/fabricated values are ever displayed in place of unreadable real data.
  - [ ] Each validation failure is written to logs and visible from the logs view.
  - [ ] After the underlying file is fixed on disk, the watcher refresh clears the broken state without an app restart.

### 10.4. Truthful workspace setting

- **ID**: GH-004
- **Story**: As a Solo Content Operator, I want the workspace folder setting to actually control which folder the app uses, so that the settings screen never lies to me.
- **Acceptance criteria**:
  - [ ] Pointing the setting at a valid alternative folder makes the app read/write that folder after the documented activation step.
  - [ ] If a restart is required, the UI states it at change time and verifies the new folder exists before saving.
  - [ ] A missing/invalid workspace produces the guided setup state on next launch, not blank screens.
  - [ ] Reverting to the previous folder restores previous behavior with no leftover state.

### 10.5. Regression-proof test suite

- **ID**: GH-005
- **Story**: As the developer-operator, I want a one-command automated test suite guarding persistence integrity, so that future changes cannot quietly reintroduce data-loss bugs.
- **Acceptance criteria**:
  - [ ] A single standard command runs the full suite locally with zero additional setup beyond repo install.
  - [ ] Suite covers: ID uniqueness under deletion/concurrency, out-of-workspace refusal, valid/invalid/corrupt persistence reads and writes.
  - [ ] Suite completes in under 2 minutes and is wired into the documented verification workflow alongside typecheck/build.
  - [ ] Introducing a deliberately buggy ID generator or unconfined delete makes the suite fail (mutation check performed once).

### 10.6. Guarded lifecycle transitions

- **ID**: GH-006
- **Story**: As a Solo Content Operator, I want the UI to offer only legal status transitions, so that my content always travels the intended lifecycle without dead-end states.
- **Acceptance criteria**:
  - [ ] Context actions on a content item expose only transitions allowed for its current status.
  - [ ] Any programmatically attempted illegal transition is refused server-side and reported with an explanatory message.
  - [ ] Rendering outcomes move statuses automatically and appear in the queue view history.
  - [ ] Marking an item posted remains reversible to ready-to-post per the existing flow.

### 10.7. Visible async feedback everywhere

- **ID**: GH-007
- **Story**: As a Solo Content Operator, I want every loading, empty, error, and success state to be visually obvious, so that I always know what the app is doing and never wait on a silent screen.
- **Acceptance criteria**:
  - [ ] Audit of all pages confirms each data view implements loading, empty, and error presentations.
  - [ ] Failed mutations restore the prior UI state and present a retry-capable error message.
  - [ ] Destructive actions require confirmation and announce their result.
  - [ ] No page shows an indefinite spinner longer than 10 seconds without an escape (cancel/error).
