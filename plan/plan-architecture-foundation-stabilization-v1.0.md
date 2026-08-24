---
goal: Foundation Stabilization — Implementation Plan (Phase 3)
version: 1.0
date_created: 2026-08-24
last_updated: 2026-08-24
owner: Glen Rio
status: 'Planned'
tags: [stabilization, persistence, security, testing, architecture]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan translates the approved Technical Specification `spec/spec-architecture-foundation-stabilization.md` (Spec v1.0, Readiness 93/100) and its upstream PRD (`docs/prd-20260824-1039-foundation-stabilization.md`, Readiness 90/100) into an executable, phase-gated implementation sequence. It covers six stabilization workstreams: durable content identifiers, workspace-confined filesystem IPC, honest validated persistence, effective workspace settings, a mandatory test harness, and universal visible async states.

Every task maps to a Spec requirement via `Ref ID` to prevent scope creep (CON-001..005, GUD-001..003). Work is sequenced **bottom-up** (electron-free foundation services first, then IPC wiring, then startup/UI, then test harness). No new runtime dependencies; test runner is `bun test`; validators are hand-written type guards (locked decisions, Spec §10).

## 1. Requirements & Constraints

- **REQ-001**: Durable unique content IDs (timestamp + random + existence re-check loop). `packages/shared` + `src/main/services/id.ts`.
- **REQ-002**: Validated reads → `LoadedEntry<T>`; invalid entries surface as Quarantined Entries; no fabricated defaults.
- **REQ-003**: Constrained writes via `mergeKnownFields` + Atomic Write; status only via legal transitions.
- **REQ-004**: Effective `workspacePath` setting → actual Workspace Root after restart; guided setup when invalid.
- **REQ-005**: Immediate `ffmpegPath` validity feedback (binary found + executable).
- **REQ-006**: All status mutations route through `assertLegalTransition` enforcing `CONTENT_STATUS_FLOW`.
- **REQ-007**: Universal async states (loading/empty/error/success); destructive actions confirm + announce.
- **REQ-008**: Runnable `bun run test` suite covering ID uniqueness, confinement refusal (Windows edges), persistence validation.
- **SEC-001**: Every path-taking IPC channel invokes Confinement Guard; refusal → `AppError('FS_PERMISSION_DENIED')` naming path.
- **SEC-002**: Only backup export/import bypass confinement per ADR-0001; each invocation logged (channel + path).
- **SEC-003**: Every refusal + validation failure logged, inspectable in logs view.
- **SEC-004**: Renderer runs strictest security defaults compatible with existing preload bridge.
- **SEC-005**: Renderer never gains Node/Electron API access beyond `window.electron`.
- **CON-001**: No new runtime deps; `bun test`; hand-written type guards.
- **CON-002**: `packages/shared/src/` is source of truth; channel/response-shape change updates handler + preload + `electron.d.ts` together.
- **CON-003**: Storage layout preserved (`accounts/`, `templates/`, `contents/`, `assets/`, `config/settings.json`).
- **CON-004**: Reuse `AppError`, `ErrorCode`, `IPCResult`, `toIPCError`, `safeIpcMain`; reuses `FS_PERMISSION_DENIED`.
- **CON-005**: Existing seeded workspaces remain readable; only creation-time behavior changes.
- **GUD-001**: Business logic in electron-free `src/main/services/`; IPC handlers stay thin shells.
- **GUD-002**: Validators pure, synchronous, total (never throw).
- **GUD-003**: Extend existing components + Zustand; no new state/styling libs.

## 2. Implementation Steps

> **EXECUTION DIRECTIVE FOR AI AGENTS:**
> You MUST execute this plan phase by phase. You MUST run the specific testing/verification task at the end of each phase. After a phase is tested, you **MUST STOP AND WAIT** for the user's explicit approval before proceeding to the next phase.

### Implementation Phase 1 — Foundation services (electron-free)

- GOAL-001: Stand up the four pure, electron-free service modules and shared validators that every downstream layer depends on.

| Task     | Description | Ref ID | AC Ref | Dep | Files | Completed | Date |
| -------- | ----------- | ------ | ------ | --- | ----- | --------- | ---- |
| TASK-001 | Create `packages/shared/src/loaded-entry.ts` (`LoadedEntry<T>` union: `valid` / `invalid` with `id`, `file`, `issues`) and `packages/shared/src/validators.ts` with `ValidationIssue`, `ValidationResult<T>`, and `validateContent` / `validateTemplate` / `validateAccount` (pure, total, return issues). | REQ-002 | AC-005, AC-006 | - | 2 | | |
| TASK-002 | Create `src/main/services/path-guard.ts`: `assertInsideWorkspace(root, candidate, channel)` — normalizes case, rejects `..` traversal above root, rejects other-drive absolute paths, throws `AppError('FS_PERMISSION_DENIED', { channel, requested })`. | SEC-001, SEC-002 | AC-003, AC-004 | - | 1 | | |
| TASK-003 | Create `src/main/services/id.ts`: `generateContentId(now?)` → `content-<YYYYMMDDTHHMMSS>-<5 hex>`; caller loops (cap 5 attempts) re-checking `fs.existsSync(join(contentsDir, id))` before first write; on exhaustion throw `FS_ALREADY_EXISTS`. | REQ-001 | AC-001, AC-002 | - | 1 | | |
| TASK-004 | Create `src/main/services/persistence.ts`: `atomicWriteJson(file, value)` (write temp + rename) and `mergeKnownFields<T>(base, patch, permit)` merging only permitted fields. | REQ-003 | AC-005 | - | 1 | | |
| TASK-005 | Create `src/main/services/lifecycle.ts`: `assertLegalTransition(from, to)` enforcing `CONTENT_STATUS_FLOW` from `packages/shared/src/index`; throws explanatory `AppError` naming both statuses on illegal attempt. | REQ-006 | AC-011 | - | 1 | | |
| TASK-00X | **VERIFY**: `bun run typecheck` — confirm `services/*` and `packages/shared/*` compile with ZERO `electron` imports. | - | - | - | - | | |
| TASK-00Y | **APPROVAL**: Wait for explicit user confirmation to proceed to Phase 2. | - | - | - | - | | |

### Implementation Phase 2 — IPC wiring + confinement

- GOAL-002: Slim the IPC layer so every path-taking channel is confined, reads emit `LoadedEntry<T>`, and content creation uses durable IDs.

| Task     | Description | Ref ID | AC Ref | Dep | Files | Completed | Date |
| -------- | ----------- | ------ | ------ | --- | ----- | --------- | ---- |
| TASK-006 | **Renderer consumer inventory (mandatory before reshape):** enumerate every call-site of `get-contents`, `get-content`, `get-templates`, `get-accounts` across renderer; record the list. Then slim `src/main/ipc/filesystem.ts`: wrap every `fs:*` handler arg through `assertInsideWorkspace(getWorkspaceRoot(), p, channel)` before any `fs/promises` call (except the two backup channels per ADR-0001); read handlers parse+validate per entry and emit `LoadedEntry<T>[]`; update `src/preload/index.ts` + `src/renderer/src/lib/electron.d.ts` atomically (CON-002). | SEC-001, SEC-002, REQ-002, REQ-003 | AC-003, AC-004, AC-005 | TASK-001, TASK-002, TASK-004 | 3 | | |
| TASK-007 | Update `workspace:create-content` in `src/main/ipc/filesystem.ts`: switch from count-based IDs to `generateContentId` + existence loop; create folder only after a successful Atomic Write plan; return created document. | REQ-001 | AC-001, AC-002 | TASK-003, TASK-004 | 1 | | |
| TASK-008 | Centralize root resolution in `getWorkspaceRoot()` (single source of truth). Implement settings save flow: validate target folder exists + is directory → persist to `config/settings.json` → respond `{ requiresRestart: true }`. | REQ-004, REQ-005 | AC-007, AC-008 | TASK-002 | 2 | | |
| TASK-00X | **VERIFY**: `bun run typecheck` + `bun run build` — preload and `electron.d.ts` compile against `LoadedEntry` shapes; build passes. | - | - | - | - | | |
| TASK-00Y | **APPROVAL**: Wait for explicit user confirmation to proceed to Phase 3. | - | - | - | - | | |

### Implementation Phase 3 — Startup sweep + Settings UI

- GOAL-003: Recover interrupted renders on launch and surface the restart/ffmpeg feedback in Settings.

| Task     | Description | Ref ID | AC Ref | Dep | Files | Completed | Date |
| -------- | ----------- | ------ | ------ | --- | ----- | --------- | ---- |
| TASK-009 | Implement Startup Sweep in main startup order (load settings → verify root → sweep → register IPC → window ready): mark interrupted `rendering` jobs/content as `failed` with reason "interrupted by shutdown" via legal `rendering → failed` edge. Invalid root routes to guided setup state. | REQ-004 | AC-008, AC-012, AC-014 | TASK-005, TASK-008 | 1-2 | | |
| TASK-010 | Settings UI: show restart notice at change time (`requiresRestart`); add immediate `ffmpegPath` validity feedback (binary found + executable) without changing resolution semantics. | REQ-004, REQ-005 | AC-007 | TASK-008 | 1-2 | | |
| TASK-00X | **VERIFY**: Manual launch with a render job left in `rendering` (simulate kill) → relaunch shows `failed` + retry path (AC-012); toggle `workspacePath` to invalid → guided setup (AC-008). | - | - | - | - | | |
| TASK-00Y | **APPROVAL**: Wait for explicit user confirmation to proceed to Phase 4. | - | - | - | - | | |

### Implementation Phase 4 — Quarantine + async states + test harness

- GOAL-004: Honest invalid-entry rendering, universal async states, and the mandatory `bun run test` suite.

| Task     | Description | Ref ID | AC Ref | Dep | Files | Completed | Date |
| -------- | ----------- | ------ | ------ | --- | ----- | --------- | ---- |
| TASK-011 | Render Quarantined Entries as read-only card variant (distinct, shows file path + issues, no fabricated defaults) inside existing list components; apply universal async states (loading/empty/error/success) to data-bearing pages; destructive actions confirm + announce outcome, restore prior state with retry. | REQ-002, REQ-007 | AC-005, AC-006, AC-013 | TASK-001, TASK-006 | 2-3 | | |
| TASK-012 | Add `"test": "bun test"` to root `package.json`. Create `tests/` mirroring `src`: `tests/validators/*.test.ts`, `tests/services/path-guard.test.ts` (incl. Windows `..`/other-drive/case edges), `tests/services/id.test.ts` (uniqueness under deletion + rapid sequential), `tests/services/persistence.test.ts` (valid/invalid/corrupt round-trips), `tests/services/lifecycle.test.ts` (illegal transition refused). Each integration test uses `mkdtemp` isolated fixture, cleaned up after. Perform mutation check once: reintroduce count-based ID generator / unconfined delete → suite fails (AC-010). | REQ-008 | AC-009, AC-010 | TASK-001..TASK-005 | 3-5 | | |
| TASK-00X | **VERIFY**: `bun run test` green in < 2 min; `bun run typecheck` + `bun run build` pass. Mutation check demonstrated red. | - | - | - | - | | |
| TASK-00Y | **APPROVAL**: Wait for explicit user confirmation (plan complete). | - | - | - | - | | |

## 3. Alternatives

- **ALT-001 (validation framework, e.g. zod):** Rejected — contract surface is small (~5 docs) and stable; hand-written guards honor minimal-change constraint (CON-001) and avoid a dependency. Drift risk mitigated by round-trip tests (AC-009).
- **ALT-002 (runtime hot-swap workspace):** Rejected — would require rewiring every cached root reference mid-session; deterministic restart is simpler and testable (Clarification Report §3).
- **ALT-003 (horizontal layer-cake slicing):** Rejected — Spec mandates vertical bottom-up sequencing; each phase leaves the app in a working state.

## 4. Dependencies

- **DEP-001**: Bun runtime + `bun test` (INF-002) — already present; no install needed.
- **DEP-002**: Existing `packages/shared/src/index.ts` (`CONTENT_STATUS_FLOW`, `Content`/`Template`/`Account` unions) and `errors.ts` (`AppError`, `ErrorCode`) — unchanged.
- **DEP-003**: FFmpeg binary referenced via `ffmpegPath` (SVC-001) — only validity feedback added this cycle.

## 5. Files

- **FILE-001**: `packages/shared/src/loaded-entry.ts` (NEW) — `LoadedEntry<T>` union.
- **FILE-002**: `packages/shared/src/validators.ts` (NEW) — type-guard validators.
- **FILE-003**: `src/main/services/path-guard.ts` (NEW) — Confinement Guard.
- **FILE-004**: `src/main/services/id.ts` (NEW) — durable ID generator.
- **FILE-005**: `src/main/services/persistence.ts` (NEW) — atomic write + constrained merge.
- **FILE-006**: `src/main/services/lifecycle.ts` (NEW) — transition enforcement.
- **FILE-007**: `src/main/ipc/filesystem.ts` (MODIFY) — confinement + `LoadedEntry` shaping + ID switch.
- **FILE-008**: `src/preload/index.ts` (MODIFY) — bridge surface for new response shapes.
- **FILE-009**: `src/renderer/src/lib/electron.d.ts` (MODIFY) — typed bridge.
- **FILE-010**: Settings service/handler + Settings UI component (MODIFY) — restart notice + ffmpeg feedback.
- **FILE-011**: Main startup sequence (MODIFY) — Startup Sweep + guided setup routing.
- **FILE-012**: Renderer list/quarantine + async-state components (MODIFY/NEW).
- **FILE-013**: `tests/` (NEW) — bun test suite mirroring `src`.
- **FILE-014**: `package.json` (MODIFY) — add `"test": "bun test"`.

## 6. Testing

- **TEST-001 (Unit)**: validators return correct `ok/issue` for valid, invalid, corrupt inputs; `generateContentId` uniqueness under deletion + rapid sequential; `mergeKnownFields` permits only listed fields; `assertLegalTransition` refuses illegal edges.
- **TEST-002 (Integration)**: services against temp-dir fixture workspaces — confinement refusal incl. Windows `..`/other-drive/case edges (AC-003); atomic write leaves no partial file on crash (F2); persistence valid/invalid/corrupt round-trips (AC-005/006).
- **TEST-003 (Mutation check, AC-010)**: once, reintroduce count-based ID generator or unconfined delete → suite turns red; then revert.
- **Merge Gate**: `bun run test` + `bun run typecheck` (+ `bun run build` when entrypoints/preload/IPC touched) must pass before claiming completion.

## 7. Risks & Assumptions

- **RISK-001 (F4 — renderer consumer inventory)**: response-shape change to `LoadedEntry<T>` is a breaking contract; all call-sites of the four listed channels MUST be inventoried (TASK-006) before the reshape lands, else silent UI breakage. *High Risk.*
- **ASSUMPTION-001 (F1)**: corrupt/unparseable `config/settings.json` → treat as first-run: fall back to defaults (`workspacePath = cwd/workspace`, empty `ffmpegPath`), log warning naming the file, engage guided setup if result invalid.
- **ASSUMPTION-002 (F2)**: partial render output after crash is never registered as a successful output; startup sweep leaves orphan partial files untouched; retry overwrites same target path.
- **ASSUMPTION-003 (F3)**: ID existence-recheck loop capped at 5 attempts; on exhaustion fail with `FS_ALREADY_EXISTS`.
- **ASSUMPTION-004 (Spec §1.2)**: new ID format `content-<YYYYMMDDTHHMMSS>-<5 hex>`; exact cosmetic format adjustable by dev agent if uniqueness/durability hold. Quarantined legacy entries render as distinct read-only card variant; no new page.
- **RISK-002**: changing `workspacePath` requires restart (not hot-swap) — UI must state this at change time and verify target exists before save.

## 8. Related Specifications / Further Reading

- PRD: `docs/prd-20260824-1039-foundation-stabilization.md`
- Spec: `spec/spec-architecture-foundation-stabilization.md`
- Discovery Draft: `docs/discovery-draft-20260824-1033-social-content-studio.md`
- Clarification Report (PRD, 90/100): `docs/audit/clarification-report-foundation-stabilization-2026-08-24.md`
- Clarification Report (Spec, 93/100): `docs/audit/clarification-report-spec-foundation-stabilization-2026-08-24.md`
- ADR-0001: `docs/adr/0001-backup-confinement-whitelist.md`
- Architecture map: `docs/ARCHITECTURE.md`
- Agent constraints: root `AGENTS.md`

## 9. Rollback / Recovery Plan

- All changes are additive or localized to the files in §5. To revert a phase: `git revert <phase-commit>` (commits should be phased per VERIFY/APPROVAL boundary).
- Storage layout (CON-003) is unchanged, so no data migration is needed; existing seeded workspaces remain readable.
- If confinement regresses, re-run `bun run test` (path-guard suite) — the suite is the safety net (AC-010 mutation check).
- Settings change is non-destructive: reverting `workspacePath` restores prior behavior with no leftover state (AC-007).
