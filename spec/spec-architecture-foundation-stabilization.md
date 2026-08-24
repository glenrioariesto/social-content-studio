---
title: Foundation Stabilization Technical Specification
version: 1.0
date_created: 2026-08-24
owner: Glen Rio
tags: [stabilization, persistence, security, testing]
---

# Introduction

This specification translates the approved PRD `docs/prd-20260824-1039-foundation-stabilization.md` and its Clarification Report (Readiness Score 90/100) into an implementable technical contract for the Social Content Studio stabilization cycle. It defines the WHAT — data contracts, module boundaries, validation rules, and acceptance criteria — for six stabilization workstreams: durable content identifiers, workspace-confined filesystem IPC, honest validated persistence, effective workspace settings, a mandatory test harness, and universal visible async states.

## 1. Purpose & Scope

The intended audience is the Implementation Planning agent (`/sdlc-plan-tasks`) and the Coding agent (`/sdlc-write-code`). The specification binds all changes made during this cycle across four layers: `packages/shared/src/` (contracts and validators), `src/main/` (services and IPC handlers), `src/preload/index.ts` plus `src/renderer/src/lib/electron.d.ts` (bridge surface), and `src/renderer/src/` (UI states).

Scope of application:

- All filesystem-touching IPC channels currently registered under `src/main/ipc/` (`fs:*`, `workspace:*`, and every other channel that resolves a user-influenced path).
- Content identifier generation for new records only; existing seeded folders are never renamed or migrated.
- Persistence read/write paths for content, template, account, and settings documents.
- Content status transitions offered or executed anywhere in the app, driven exclusively by `CONTENT_STATUS_FLOW` from `packages/shared/src/index.ts`.

## 1.1 Out of Scope

- Platform API integrations, automated publishing, or any `scheduled` status concept (manual publishing boundary holds).
- New render presets, resolution changes, or modifications to `RENDER_PRESETS`.
- HTML-to-video frame capture; no Playwright/Chromium introduction.
- Adding a `platform` field to `Content`; renderer components must not invent platform persistence.
- Migrating storage to a database or introducing network sync.
- Hot-swapping the active workspace at runtime; activation is save-plus-restart (Clarification Report §3).
- Renaming or rewriting legacy count-based content folders; legacy collisions are quarantined read-only, not auto-repaired.
- End-to-end Electron UI automation tests (driver introduction is deferred; seams in Section 6 cover this cycle).
- Any widening of the confinement whitelist beyond ADR-0001.

## 1.2 Open Questions & Assumptions

All architectural questions raised during synthesis were resolved with the user (test runner and validation approach are locked decisions recorded in Section 10). Remaining assumptions are non-blocking implementation details:

- **ASSUMPTION:** New content identifiers use the format `content-<YYYYMMDDTHHMMSS>-<5 hex chars>` (compact local timestamp plus crypto-random suffix), with an existence re-check loop against the target directory before first write. Exact cosmetic format may be adjusted by the dev agent as long as uniqueness and durability guarantees hold.
- **ASSUMPTION:** Quarantined legacy entries render inside existing list components as a distinct read-only card variant; no new page is introduced.
- **ASSUMPTION:** Renderer hardening (GH-008 / "Hardened renderer defaults") is limited to flags compatible with the current preload bridge; whatever relaxation remains is documented in `docs/ARCHITECTURE.md` rather than forced.
- **ASSUMPTION:** The backup export/import channels referenced by the PRD are inventoried from the actual handler registrations at implementation time; this spec constrains their policy (ADR-0001) regardless of registration site.
- **CLARIFICATION NEEDED:** None.

## 2. Definitions

Vocabulary is anchored to the shared contracts in `packages/shared/src/index.ts` and `packages/shared/src/errors.ts`. No `CONTEXT.md` exists yet (lazy creation rule); the following terms are canonical for this cycle:

- **Workspace Root:** The single base directory all confined operations resolve against. Currently `join(process.cwd(), 'workspace')`; becomes the persisted, validated `workspacePath` per REQ-004.
- **Confinement Guard:** The main-process function that resolves a requested path and refuses anything resolving outside the Workspace Root.
- **Whitelist Exception:** Backup export/import channels permitted to access user-chosen paths outside the Workspace Root because every invocation originates from an explicit dialog action. Governed by ADR-0001. Every invocation is logged with channel and path. `_Avoid:_ "escape hatch", "bypass".`
- **Atomic Write:** Write-to-temp-then-rename persistence ensuring a crash never leaves a truncated or half-written canonical document.
- **Type-Guard Validator:** A hand-written pure function in `packages/shared` checking an unknown parsed value against a document contract, returning structured issues instead of throwing. `_Avoid:_ "schema check", "zod schema".`
- **Quarantined Entry:** A loaded document that failed validation, surfaced read-only with its file path and issues; never replaced by fabricated defaults.
- **Startup Sweep:** The launch-time pass marking render jobs and contents interrupted mid-render as `failed` with reason "interrupted by shutdown", using the legal `rendering -> failed` edge.
- **Legal Transition:** A status change permitted by `CONTENT_STATUS_FLOW`. Illegal transitions are refused server-side with an explanatory error.
- **Merge Gate:** The minimum verification set for merging any change this cycle: `bun run test` plus `bun run typecheck` (plus `bun run build` when entrypoints, preload, IPC, or bundling are touched).

## 3. Requirements, Constraints & Guidelines

### Requirements

- **REQ-001 (Durable unique identifiers, GH-001):** Creating a content item always yields an identifier never used before in the same workspace, regardless of deletions or rapid sequential creation. Generation must not depend on directory count. An existence re-check precedes first write; on collision the generator retries with fresh randomness.
- **REQ-002 (Validated reads, GH-003):** Every persisted document read (content, template, account) passes through a Type-Guard Validator. Valid entries load normally; invalid entries surface as Quarantined Entries carrying file path and issue list, while sibling entries still load. Fabricated default objects are prohibited at read boundaries.
- **REQ-003 (Constrained writes):** Writes merge only fields permitted for the target document type, then persist via Atomic Write. Status fields change only through Legal Transition checks (REQ-006).
- **REQ-004 (Effective workspace setting, GH-004):** `config/settings.json` `workspacePath` becomes the actual Workspace Root used by all handlers after app restart. Saving validates the folder exists; the UI states the restart requirement at change time. Missing or invalid configured workspace produces the guided setup state on launch.
- **REQ-005 (FFmpeg path feedback):** Settings surfaces immediate validity feedback for `ffmpegPath` (binary found and executable) without changing resolution semantics.
- **REQ-006 (Transition guards, GH-006):** All status mutations route through a shared transition function enforcing `CONTENT_STATUS_FLOW`; illegal attempts return an explanatory error naming current and requested statuses. Render-driven transitions remain automatic.
- **REQ-007 (Universal async states, GH-007):** Every asynchronous view implements loading, empty, error, and success presentations; destructive actions confirm first and announce results; no spinner exceeds 10 seconds without cancel/error escape.
- **REQ-008 (Test harness, GH-005):** A runnable suite executes via a single standard command (`bun run test`) covering identifier uniqueness under deletion/concurrency, out-of-workspace refusal including Windows edge inputs, and persistence validation (valid, invalid, and corrupt-file cases).

### Security Requirements

- **SEC-001:** Every path-taking IPC channel invokes the Confinement Guard before any filesystem call. Refusals throw `AppError` with code `FS_PERMISSION_DENIED` and `details` naming the offending absolute path.
- **SEC-002:** Only backup export/import channels bypass SEC-001, strictly per ADR-0001 (explicit dialog intent), and each such invocation is logged with channel and path.
- **SEC-003:** Every confinement refusal and every validation failure is written to the app log (channel/file, path, issues) and remains inspectable in the queue/logs views.
- **SEC-004:** Renderer process runs with the strictest security defaults compatible with the existing preload bridge; residual relaxations are documented in `docs/ARCHITECTURE.md`.
- **SEC-005:** The renderer never gains direct Node/Electron API access beyond the existing `window.electron` bridge; no new arbitrary-path API is exposed.

### Constraints

- **CON-001:** No new runtime dependencies. Test runner is `bun test`; validators are hand-written type guards.
- **CON-002:** `packages/shared/src/` stays the source of truth. Any channel/response-shape change updates handler, preload, and `electron.d.ts` together.
- **CON-003:** Storage layout preserved: `workspace/accounts/`, `workspace/templates/`, `workspace/contents/`, `workspace/assets/`, `workspace/config/settings.json`.
- **CON-004:** Error handling reuses `AppError`, `ErrorCode`, `IPCResult`, `toIPCError`, and `safeIpcMain`. Outside-workspace refusals reuse `FS_PERMISSION_DENIED` (rationale: no `ErrorCode` union change needed; details field disambiguates policy refusal from OS denial).
- **CON-005:** Existing seeded workspaces remain readable; only creation-time behavior changes.

### Guidelines

- **GUD-001:** Business logic lives in electron-free service modules under `src/main/services/`; IPC handlers stay thin shells that translate `AppError` into `IPCResult` via the existing safe-handler pattern. This extraction is mandatory because `bun test` cannot import modules that pull in `electron`.
- **GUD-002:** Validators are pure, synchronous, and total (never throw); they return discriminated results so callers decide presentation.
- **GUD-003:** Prefer extending existing components and Zustand store patterns over introducing new state libraries or styling systems.

## 4. Interfaces & Data Contracts

### 4.1 New shared contracts (`packages/shared/src/`)

```ts
// validators.ts - hand-written type guards (locked decision: no zod)
export interface ValidationIssue {
  field: string        // dotted path, e.g. "account.workflows[2].id"
  message: string      // human-readable, English
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] }

export function validateContent(raw: unknown): ValidationResult<Content>
export function validateTemplate(raw: unknown): ValidationResult<Template>
export function validateAccount(raw: unknown): ValidationResult<Account>

// loaded-entry.ts - list payload shape for honest reads
import type { Content } from './index'

export type LoadedEntry<T> =
  | { kind: 'valid'; id: string; data: T }
  | { kind: 'invalid'; id: string; file: string; issues: ValidationIssue[] }
```

Rules:

- `validateContent` enforces required identity and lifecycle fields (`id`, `accountId`, `createdAt`, `updatedAt`, `status` within the known union) plus structural sanity of optional fields; it does not enforce business rules like transitions.
- List responses from `workspace:get-contents`, `workspace:get-templates`, and `workspace:get-accounts` become `LoadedEntry<T>[]`. This is a response-shape change: preload and `electron.d.ts` MUST be updated in the same change set (CON-002).
- Single-document reads (`workspace:get-content`) return `IPCResult<LoadedEntry<Content>>` as well, so detail views can render the quarantined variant.

### 4.2 Main-process service modules (`src/main/services/`)

```ts
// path-guard.ts - the Confinement Guard
import { createAppError } from '../../../packages/shared/src/errors'

export interface ConfinedPath { readonly absolute: string }

/**
 * Resolves candidate against root and refuses traversal outside it.
 * Windows-safe: normalizes case for comparison; rejects drive-absolute
 * targets on another drive; treats '..' segments purely lexically after
 * resolve() so crafted symlinks inside the workspace pointing outward
 * are out of scope until symlinks are ever introduced (see 1.2).
 */
export function assertInsideWorkspace(
  root: string,
  candidate: string,
  channel: string
): ConfinedPath // throws AppError('FS_PERMISSION_DENIED', ..., details: { channel, requested })

// id.ts - durable identifier generation (pure, electron-free)
export function generateContentId(now?: Date): string
// e.g. "content-20260824T103912-a7f3e"; caller loops while
// fs.existsSync(join(contentsDir, id)) before first write.

// persistence.ts - atomic write + constrained merge
export async function atomicWriteJson(file: string, value: unknown): Promise<void>
export function mergeKnownFields<T>(base: T, patch: Record<string, unknown>, permit: ReadonlyArray<keyof T>): T

// lifecycle.ts - transition enforcement (shared rule, main-side application)
import { CONTENT_STATUS_FLOW } from '../../../packages/shared/src/index'
export function assertLegalTransition(from: ContentStatus, to: ContentStatus): void
```

### 4.3 Handler obligations (`src/main/ipc/filesystem.ts`)

- Each `fs:*` handler resolves its argument through `assertInsideWorkspace(getWorkspaceRoot(), p, channel)` before any `fs/promises` call, except the two backup channels governed by ADR-0001.
- `workspace:create-content` switches from count-based IDs to `generateContentId` + existence loop, creates the folder only after a successful Atomic Write plan, and returns the created document.
- Read handlers wrap parse+validate per entry and emit `LoadedEntry<T>` shapes; parse failures produce `kind: 'invalid'` entries plus a log record (SEC-003), never thrown away silently.
- `getWorkspaceRoot()` centralizes root resolution so REQ-004 has exactly one point of truth.

### 4.4 Settings & startup

- Settings save flow: validate target folder exists (and is a directory) -> persist to `config/settings.json` -> respond with `{ requiresRestart: true }` -> UI shows the restart notice at change time.
- Startup order: load settings -> verify Workspace Root exists -> run Startup Sweep (mark interrupted `rendering` jobs/content as `failed`, reason "interrupted by shutdown") -> register IPC -> window ready. Invalid root routes to guided setup state instead of broken pages.

## 5. Acceptance Criteria

- **AC-001 (GH-001):** Given a workspace with N content folders, When a new item is created, Then the resulting folder name differs from every existing and previously deleted identifier; creating 10 items sequentially yields 10 coexisting editable records.
- **AC-002 (GH-001):** Given 5 creations issued within one second, When all complete, Then 5 distinct folders exist with no partial or empty records.
- **AC-003 (GH-002):** Given any `fs:*` request whose path resolves outside the Workspace Root (including `..` segments, other-drive absolute paths, case variants), When invoked, Then the result is `{ success: false, errorCode: 'FS_PERMISSION_DENIED' }` naming the requested path, and a log entry records channel + path.
- **AC-004 (ADR-0001):** Given a backup export invoked through its user dialog, When it writes outside the workspace, Then it succeeds and a log entry records channel + destination path.
- **AC-005 (GH-003):** Given `contents/x/content.json` contains invalid JSON or fails field validation, When the contents list loads, Then entry x renders as a read-only broken card showing its file path, siblings still load, and the failure appears in logs view; fixing the file on disk clears the state via watcher refresh without restart.
- **AC-006 (GH-003):** Given any unreadable document, When rendered, Then no fabricated default values substitute for real data anywhere in the UI.
- **AC-007 (GH-004):** Given a valid alternative folder chosen in Settings, When saved, Then the UI states restart is required and persists `workspacePath`; after restart the app reads/writes that folder; reverting restores prior behavior with no leftover state.
- **AC-008 (GH-004):** Given `workspacePath` points to a missing folder, When the app launches, Then the guided setup state renders instead of blank/broken pages.
- **AC-009 (GH-005):** Given the repository freshly installed, When `bun run test` runs, Then the suite passes in under 2 minutes covering ID uniqueness (deletion + rapid sequential), confinement refusal (including Windows edges), and valid/invalid/corrupt persistence round-trips.
- **AC-010 (GH-005, mutation check):** Given a deliberately buggy ID generator (count-based) or an unconfined delete is reintroduced, When the suite runs, Then it fails (verified once manually during implementation).
- **AC-011 (GH-006):** Given a content item in any status, When its context menu opens, Then only transitions permitted by `CONTENT_STATUS_FLOW` are offered; a programmatic illegal attempt returns an explanatory error naming both statuses.
- **AC-012 (Startup Sweep):** Given the app crashed with a job in `rendering`, When the app relaunches, Then that job and its content are marked `failed` with "interrupted by shutdown" and can be retried through the existing `failed -> rendering` flow.
- **AC-013 (GH-007):** Given any data-bearing page, When inspected, Then loading, empty, and error states exist; destructive actions require confirmation and report outcome; failed mutations restore prior UI state with retry available.
- **AC-014 (Shutdown):** Given active render jobs, When quit is attempted, Then a confirmation lists in-flight jobs with "cancel quit" as default action.

## 6. Test Automation Strategy & Testing Seams

- **Testing Seams:** Exactly two primary seams, both Electron-free so `bun test` exercises them directly: (1) `packages/shared` validators and pure helpers; (2) `src/main/services/*` (path-guard, id, persistence, lifecycle) run against temporary directory fixtures. IPC handlers themselves are thin shells deliberately kept out of unit scope.
- **Test Levels:** Unit (validators, ID generator, mergeKnownFields, assertLegalTransition) and Integration (services against temp-dir workspaces, including corrupt-file scenarios and confinement edge inputs). No E2E this cycle (Section 1.1).
- **Test Data Management:** Each integration test builds an isolated fixture workspace under the OS temp dir (`mkdtemp`), seeds known documents (valid, invalid, corrupt), and removes it in cleanup. No shared mutable fixtures.
- **CI/CD Integration:** No CI exists yet; the documented workflow adds `bun run test` alongside `bun run typecheck` as the Merge Gate (AGENTS.md already mandates typecheck/build commands).
- **Coverage Requirements:** No percentage threshold; compliance is scenario-driven per AC-009/AC-010. Mutation check performed once to prove suite sensitivity.

## 7. Project Structure & Commands

### Project Structure

```text
packages/shared/src/
  index.ts              # existing contracts (source of truth, unchanged unions)
  errors.ts             # existing error model (unchanged)
  validators.ts         # NEW: type-guard validators
  loaded-entry.ts       # NEW: LoadedEntry<T> union
src/main/
  ipc/filesystem.ts     # slimmed: confinement calls + LoadedEntry shaping
  ipc/safe-handler.ts   # unchanged pattern
  services/path-guard.ts # NEW
  services/id.ts          # NEW
  services/persistence.ts # NEW
  services/lifecycle.ts   # NEW
tests/                  # NEW: bun test files (*.test.ts), mirrors src layout
```

Tests live under `tests/` mirroring the source tree (e.g., `tests/services/path-guard.test.ts`, `tests/validators/content.test.ts`). Main-process sources must therefore contain zero `electron` imports in `services/` and `packages/shared/` (GUD-001).

### Commands

- **Build:** `bun run build`
- **Test:** `bun run test` (new script: `"test": "bun test"` in root `package.json`)
- **Typecheck:** `bun run typecheck` (runs `typecheck:node` + `typecheck:web`)
- **Lint/Format:** `bun run lint`
- **Dev:** `bun run dev`

## 8. Code Style & Conventions

Handlers stay thin and comment-free, matching the existing style:

```ts
safeIpcMain('fs:read-file', async (_event, filePath: string) => {
  const p = assertInsideWorkspace(wsRoot(), filePath, 'fs:read-file')
  const content = await readFile(p.absolute, 'utf-8')
  return { success: true, data: content }
}, 'FS_READ_ERROR')
```

Conventions: named exports only; camelCase functions; types imported via `import type` where possible; errors constructed with `createAppError` and context objects (`{ channel, requested }`); no inline comments except where a decision needs recording; UI follows existing React + Zustand + Tailwind + Lucide patterns.

## 9. Implementation Boundaries

- **Always do:** Run `bun run test` + `bun run typecheck` before claiming completion (Merge Gate); route every path through the Confinement Guard; emit `LoadedEntry` shapes on list reads; log refusals and validation failures; update handler + preload + `electron.d.ts` atomically per channel; use Atomic Write for every canonical JSON write; enforce transitions via `assertLegalTransition`.
- **Ask first:** Introducing any dependency (runtime OR dev); toggling Electron security flags (`sandbox`, `contextIsolation`); modifying `CONTENT_STATUS_FLOW`, `RenderPreset`, or any shared union; changing `maxConcurrentRender` semantics; adding/removing IPC channels.
- **Never do:** Return fabricated defaults for unreadable documents; catch-and-continue around parse/validation failures; expose raw `fs` capabilities to the renderer; widen the ADR-0001 whitelist; rename/migrate legacy content folders; spawn FFmpeg outside the render queue; commit secrets or remove failing tests to force green.

## 10. Rationale, Context & Architecture Decisions (ADRs)

- **ADR-0001 (`docs/adr/0001-backup-confinement-whitelist.md`) — BINDING:** Backup export/import is the sole confinement exception. SEC-002 operationalizes it; Section 1.1 forbids widening it. Any feature wanting similar freedom must earn its own ADR.
- **Locked decision — `bun test`:** Repo standardizes on bun commands; PRD demands the harness fit existing Bun + electron-vite tooling; zero-config beats richer ecosystem for a stabilization cycle. Consequence: electron-free service extraction is mandatory (GUD-001).
- **Locked decision — hand-written type guards:** Contract surface is small (~5 documents) and stable; avoiding a validation framework honors minimal-change constraints; drift risk mitigated by round-trip tests (AC-009).
- **Timestamp-based IDs:** Count-based generation (`filesystem.ts:129-131`) is the root cause of overwrite risk; timestamp+random provides durability without extra coordination state, keeps folder names human-scannable, and sorts naturally by creation time.
- **Restart-model activation:** Runtime hot-swap would require rewiring every cached root reference mid-session; deterministic restart honors the clarification resolutions and simplifies REQ-004 testing.
- No new ADR is required by this spec; if the dev phase flips a security flag that proves hard to reverse, the dev agent must propose an ADR at that moment.

## 11. Dependencies & External Integrations

### External Systems

- None. The app is local-first; no network services are introduced or consumed by this cycle.

### Third-Party Services

- **SVC-001:** FFmpeg binary — external executable located via `ffmpegPath`; this cycle only adds validity feedback (exists/executable), leaving invocation semantics to the existing render pipeline.

### Infrastructure Dependencies

- **INF-001:** Electron main/preload/renderer process boundary — all new logic respects it; renderer touches nothing but `window.electron`.
- **INF-002:** Bun runtime test runner — provides `bun test` with no additional install steps.

### Data Dependencies

- **DAT-001:** Workspace JSON store (`accounts/`, `templates/`, `contents/`, `assets/`, `config/settings.json`) — sole persistence medium; layout frozen per CON-003.
- **DAT-002:** Legacy count-based content folders — read-compatible input; quarantined on collision detection, never rewritten.

## 12. Examples & Edge Cases

```text
Workspace root: C:\project\social-content-studio\workspace

Input                                  -> Resolution
..\..\Windows\system32\config.sam      -> REFUSED  (resolves above root)
C:\Elsewhere\note.txt                  -> REFUSED  (different drive prefix)
c:\PROJECT\social-content-studio\WORKSPACE\a.json
                                       -> ALLOWED  (case-insensitive match)
workspace\templates\t\template.json    -> ALLOWED  (relative, joins under root)
fs:rm on ..                            -> REFUSED  (root itself is the boundary;
                                                    deleting root is refused)

Corrupt entry shaping (list response):
[
  { "kind": "valid",   "id": "content-20260820T091500-b12f4", "data": { ... } },
  { "kind": "invalid", "id": "content-003",
    "file": "C:\\...\\workspace\\contents\\content-003\\content.json",
    "issues": [ { "field": "status", "message": "unknown status \"don\"" } ] }
]
```

## 13. Validation Criteria

- `bun run test` green, completing in under 2 minutes, covering AC-001/002/003/005/009 scenarios at the service seam.
- Mutation check (AC-010) demonstrated once: reintroducing a count-based ID generator or unconfined delete turns the suite red.
- `bun run typecheck` and `bun run build` pass; preload and `electron.d.ts` compile against the `LoadedEntry` response shapes.
- Manual soak across the three brands confirms: zero ID collisions in logs, refusal log entries reviewable from the logs view, quarantined cards clear after on-disk fixes, restart model behaves per AC-007/AC-008.
- Startup Sweep verified by simulating a killed render (job left in `rendering`) and confirming post-restart `failed` + retry path (AC-012).

## 14. Related Specifications / Further Reading

- PRD: `docs/prd-20260824-1039-foundation-stabilization.md`
- Discovery Draft: `docs/discovery-draft-20260824-1033-social-content-studio.md`
- Clarification Report (90/100): `docs/audit/clarification-report-foundation-stabilization-2026-08-24.md`
- ADR-0001: `docs/adr/0001-backup-confinement-whitelist.md`
- Architecture map: `docs/ARCHITECTURE.md`
- Agent constraints: root `AGENTS.md`
