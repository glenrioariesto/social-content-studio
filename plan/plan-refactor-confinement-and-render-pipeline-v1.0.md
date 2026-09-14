---
goal: Close code-review remnants: fs confinement create-regression, render/batch path confinement, render pipeline content persistence, batch canonical layout, vault secrecy, renderer queued-vocabulary purge, and workspace root alignment
version: 1.0
date_created: 2026-09-13
owner: SDLC Code Phase
status: "Planned"
tags: ["refactor", "security", "confinement", "render-pipeline", "batch"]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-yellow)

Code review (2-axis) found a critical regression and required hardening gaps
in the confinement / render / batch surfaces left over from the code-review
and code-health refactors. This plan closes them: (1) restore the ability to
create new files/dirs through the `fs:*` bridge, (2) confine every render and
batch filesystem operation to the workspace root, (3) make the render queue
in real walls persist content/output state so retry works, (4) route batch
content creation/enqueue through the canonical validated layout, (5) keep the
Repliz credential vault unreadable to the renderer, (6) finish the `queued`
vocabulary purge across `src/renderer`, and (7) anchor all resolved paths to
a single `getWorkspaceRoot()`.

## 1. Traceability: Requirements & Constraints

- **REQ-001**: [Functional] A render must be enqueued through the render queue service; a successful render updates persisted content + output state (`ready-to-post`, `content.output`); failures leave the content `failed` so the legal `failed â†’ rendering` retry edge works.
- **REQ-002**: [Functional] Render status vocabulary is `waiting`; `queued` appears only in documented exceptions (render-queue legacy remap). Zero `queued` tokens in `src/` otherwise, including `src/renderer`. (Batch IPC field renamed `{ queued }` → `{ added }` so the renderer stays clean.)
- **REQ-003**: [Functional] All content status mutations route through `assertLegalTransition` (REQ-006/AC-011 from spec-architecture-foundation-stabilization).
- **PRN-001**: [Architecture] Every filesystem surface reached from the renderer is confined via `assertInsideWorkspace` against the resolved workspace root; no raw path from the renderer reaches `fs/promises` or `spawn(ffmpeg)`.
- **PRN-002**: [Architecture] Canonical persistence layout is `workspace/<kind>/<id>/<doc>.json` via `loadDirEntries` / `atomicWriteJson` / `generateUniqueContentId`; no flat-fragment writes on a live channel.
- **PRN-003**: [Architecture] A single `getWorkspaceRoot()` anchors logs, settings, credentials, batch, render queue, and content paths; `process.cwd()/workspace` is only the no-settings default.
- **SEC-001**: [Security] Secret material (`config/*.enc.json`, `*credentials*`) is never readable through a generic renderer-facing fs channel.
- **SEC-002**: [Security] Symlink confinement applies on read paths (target must exist) and, for create operations, on the parent directory (target leaf need not pre-exist).
- **CON-001**: [Constraint] No new dependency; bun test harness remains the only verification gate; no behavioral change to statuses or switchable contracts.

## 2. Implementation Steps

> **âš ï¸ EXECUTION DIRECTIVE FOR AI AGENTS (`/sdlc-write-code`):**
> You MUST execute this plan phase by phase. You MUST run the specific testing/verification task at the end of each phase. After a phase is tested, you **MUST STOP AND WAIT** for the user's explicit approval before proceeding to the next phase. **DO NOT SKIP PHASES.**

### Implementation Phase 1: Restore fs create + confine every render/batch path

- **GOAL-001:** Fix the `guardOrThrow` create-regression (STD-01) and extend confinement to `render:*` and `batch:*` (STD-02, STD-05), blocking the credentials vault from generic reads (STD-03).

| Task ID | Description (Include Exact File Paths & Micro-Testing) | Ref ID | Completed | Date |
| ------- | ------------------------------------------------------ | ------ | :-------: | :--: |
| TASK-101 | `src/main/ipc/filesystem.ts` `guardOrThrow`: for create operations (`fs:write-file`, `fs:mkdir`) resolve `realpath` of the **parent directory** and verify containment, then operate on the candidate leaf; keep full-target `realpath` for read/stat/exists/readdir/rm. Ensure `fs:rm` recursive also realpaths the deepest existing ancestor so removing a present dir still works. | SEC-002 / STD-01 | [ ] | |
| TASK-102 | `src/main/ipc/filesystem.ts` `fs:read-file`: refuse paths whose normalized form matches `config/*credentials*` or `*.enc.json` (secrets deny-list) before `guardOrThrow`, returning a generic FS permission error and logging (SEC-003). | SEC-001 / STD-03 | [ ] | |
| TASK-103 | `src/main/ipc/render.ts`: confine `inputPath`, `outputPath`, `overlayPath` via `assertInsideWorkspace(ws(), path, channel)`; default output path to `workspace/renders` when renderer omits it; pass only confined paths into `renderQueue.addJob` / `generateThumbnail`. | PRN-001 / STD-02 | [ ] | |
| TASK-104 | `src/main/ipc/batch.ts`: confine `csvPath` (parse-csv) and `outputPath` (export-csv) via `assertInsideWorkspace`; drop the hard-coded `join(process.cwd(),'workspace')` in favor of `getWorkspaceRoot()`. | PRN-001, PRN-003 / STD-05 | [ ] | |
| TASK-105 | Micro-test `tests/security/fs-confinement.test.ts`: (a) `fs:write-file` + `fs:mkdir` to a NEW path under root succeeds; (b) `..\escape` and other-drive candidates are refused; (c) `config/repliz-credentials.enc.json` via `fs:read-file` is refused; (d) render/batch path candidates escaping root are refused by the new guards. | SEC-001, SEC-002 | [x] | |
| TASK-106 | **VERIFY**: `bun test tests/security/fs-confinement.test.ts` pass; `bun run typecheck:node`. | - | [x] | |
| TASK-107 | **APPROVAL**: ðŸ›‘ Wait for explicit user confirmation to proceed to Phase 2. | - | [x] | |

### Implementation Phase 2: Render pipeline persistence + duplicate guard

- **GOAL-002:** Persist content/output on render completion, mark content `failed` on render failure, and reject duplicate enqueues (SPEC-01, SPEC-02).

| Task ID | Description (Include Exact File Paths & Micro-Testing) | Ref ID | Completed | Date |
| ------- | ------------------------------------------------------ | ------ | :-------: | :--: |
| TASK-201 | `src/main/services/render-queue.ts`: add a `contentStateHooks` (or equivalent injected callbacks) invoked on `job:completed` and `job:failed`; wire them in `src/main/ipc/render.ts` (or `index.ts`) to (a) load the content doc for `job.contentId`, (b) `assertLegalTransition('rendering','ready-to-post')` + write `content.output = { video, thumbnail }` via `atomicWriteJson` on success, or `assertLegalTransition('rendering','failed')` on failure. Guard everything so a missing content doc logs a warning, not an unhandled rejection. | REQ-001 / SPEC-02 | [x] | |
| TASK-202 | `src/main/ipc/render.ts` `render:start`: before `addJob`, reject (with a clear `RENDER_FAILED` error) when `getActiveJobs()` already contains the same `contentId` â€” prevents duplicate ffmpeg processes. | REQ-001 / SPEC-01 | [x] | |
| TASK-203 | Micro-test `tests/services/render-pipeline.test.ts`: with mocked `renderVideo` (success + failure) assert (a) completed job transitions the content doc to `ready-to-post` and writes `output.video`, (b) failed job transitions content to `failed`, (c) duplicate enqueue of an active `contentId` is refused. Reuse the existing `mock.module` electron pattern from `tests/services/render-queue.test.ts`. | REQ-001, REQ-003 | [x] | |
| TASK-204 | **VERIFY**: `bun test tests/services/render-pipeline.test.ts tests/services/render-queue.test.ts` pass; `bun run typecheck:node`. | - | [x] | |
| TASK-205 | **APPROVAL**: ðŸ›‘ Wait for explicit user confirmation to proceed to Phase 3. | - | [x] | |

### Implementation Phase 3: Batch canonical layout + renderer vocabulary

- **GOAL-003:** Make `batch:create-content` / `batch:enqueue-all` write canonical, validated documents and purge `queued` from the renderer UI and the scan test (SPEC-03, SPEC-04, SPEC-05).

| Task ID | Description (Include Exact File Paths & Micro-Testing) | Ref ID | Completed | Date |
| ------- | ------------------------------------------------------ | ------ | :-------: | :--: |
| TASK-301 | `src/main/ipc/batch.ts` `batch:create-content`: use `generateUniqueContentId(contentsDir)` + `atomicWriteJson(join(contentsDir, id, 'content.json'), content)`; build the document with the shared `Content` shape (`status:'draft'`, `accountId`, `templateId`, etc.) so `loadDirEntries`/`validateContent` surface it. | REQ-003, PRN-002 / SPEC-04 | [x] | |
| TASK-302 | `src/main/ipc/batch.ts` `batch:enqueue-all`: stop writing `status:'rendering'` directly. Instead route every item through `assertLegalTransition(content.status,'ready')`? NO â€” enqueue by calling `renderQueue.addJob` with the render options derived from the content, or reject cleanly when a render already exists (SYNC with TASK-202 behavior). Do not mutate status beyond the transition guard. | REQ-001, REQ-003 / SPEC-03 | [x] | |
| TASK-303 | `src/renderer/src/pages/BatchRenderPage.tsx`: replace `queued` state/labels/toast with `added` / `scheduled` wording (lines 27, 71, 84, 87, 204). | REQ-002 / SPEC-05 | [x] | |
| TASK-304 | `tests/security/queued-vocabulary.test.ts`: add `src/renderer` to the scan roots. The `batch:enqueue-all` IPC field was renamed `queued` → `added` so `electron.d.ts` needs no exception. | REQ-002 / SPEC-05 | [x] | |
| TASK-305 | Micro-test `tests/main/batch-create-content.test.ts`: assert batch-created documents appear via `loadDirEntries` (canonical layout), pass `validateContent`, and that `enqueue-all` results in real render jobs. | REQ-003, PRN-002 | [x] | |
| TASK-306 | **VERIFY**: `bun test tests/security/queued-vocabulary.test.ts tests/main/batch-create-content.test.ts` pass; `bun run typecheck`. | - | [x] | |
| TASK-307 | **APPROVAL**: ðŸ›‘ Wait for explicit user confirmation to proceed to Phase 4. | - | [x] | |

### Implementation Phase 4: Workspace-root alignment + dead-code cleanup

- **GOAL-004:** Anchor all workspace paths to `getWorkspaceRoot()` and remove dead exports (STD-04, STD-09).

| Task ID | Description (Include Exact File Paths & Micro-Testing) | Ref ID | Completed | Date |
| ------- | ------------------------------------------------------ | ------ | :-------: | :--: |
| TASK-401 | `src/main/errors.ts`, `src/main/services/repliz.ts`, `src/main/services/workspace-root.ts`, `src/main/services/render-queue.ts`: replace `join(process.cwd(),'workspace',...)` with a `getWorkspaceRoot()`-based resolution (lazy, cached at module init after settings are known); keep `cwd/workspace` only as the no-settings default. | PRN-003 / STD-04 | [x] | |
| TASK-402 | Remove dead code: unused `renderVideo` import in `src/main/ipc/render.ts:5`; unused export `renderFromTemplate` in `src/main/services/render-engine.ts:133-156` (if truly callerless per grep); `handleIPCCall` wrapper in `src/renderer/src/lib/error-logger.ts` if callerless. | PRN-003 / STD-09 | [x] | |
| TASK-403 | **VERIFY**: `bun run verify` green (typecheck node+web, full suite, build). | - | [x] | |
| TASK-404 | **APPROVAL**: Wait for explicit user confirmation to finalize. | - | [x] | |

## 3. Structural Remedies & Alternatives

- **ALT-001 (deny-list only vs narrow channel):** Rejected narrow `fs:*` to a whitelisted subfolder tree because renderer legitimately reads templates, assets, and contents; a secrets **deny-list** on `fs:read-file` (removed in plan) is the minimal surface.
- **ALT-002 (hard-fail vault vs base64 fallback):** Prefer keeping the honest `encrypted:false` fallback for offline storm (per ADR-0004) but **protect** the file via deny-list; if the reviewer/user prefers, a hard-fail when `safeStorage` is unavailable is the stricter alternative.
- **ALT-003 (must-exist vs may-create ops):** Splits guard behavior by operation kind rather than introducing a separate whitelist of allowed tree depths â€” keeps the contain logic explicit per channel.

## 4. Dependencies

- **DEP-001**: None. No new runtime or dev dependency.

## 5. Files Affected

- **FILE-001**: `src/main/ipc/filesystem.ts` â€” split `guardOrThrow` into read-style (target must exist) vs create-style (parent realpath); secrets deny-list.
- **FILE-002**: `src/main/ipc/render.ts` â€” confine render paths; duplicate-enqueue guard; content-state hooks wiring.
- **FILE-003**: `src/main/ipc/batch.ts` â€” confine csv/export paths; canonical create; real enqueue.
- **FILE-004**: `src/main/ipc/agent.ts` â€” reuse helpers (already done in code-review; verify no regression).
- **FILE-005**: `src/main/services/render-queue.ts` â€” content-state hooks + root-based persistFile.
- **FILE-006**: `src/main/errors.ts`, `src/main/services/repliz.ts`, `src/main/services/workspace-root.ts` â€” root-aligned paths.
- **FILE-007**: `src/main/services/render-engine.ts`, `src/renderer/src/lib/error-logger.ts` â€” remove callerless exports/imports.
- **FILE-008**: `src/renderer/src/pages/BatchRenderPage.tsx` â€” `queued` â†’ `added`/`scheduled` vocabulary.
- **FILE-009**: `src/main/services/path-guard.ts` â€” resolve candidates relative to workspace root instead of `process.cwd()`.
- **FILE-010**: Tests â€” `tests/security/fs-confinement.test.ts` (new), `tests/services/render-pipeline.test.ts` (new), `tests/security/queued-vocabulary.test.ts` (extended), `tests/main/batch-create-content.test.ts` (new).

## 6. Testing Strategy

- **TEST-001**: Confinement â€” new-file write/mkdir succeeds; escape paths refused; secret vault read refused (Phase 1).
- **TEST-002**: Render pipeline â€” completion persists `ready-to-post` + output; failure sets content `failed`; duplicate enqueue rejected (Phase 2).
- **TEST-003**: Batch â€” created documents are validated + canonical; enqueue-all produces real jobs (Phase 3).
- **TEST-004**: Vocabulary â€” `queued` absent from `src/renderer` source (Phase 3).
- **TEST-005**: Macro â€” `bun run verify` (full suite zero failures + build) at final gate (Phase 4).

## 7. Risks & Rollback Plan

- **RISK-001:** Realpath-parent changes could accidentally weaken symlink protection on create if the parent itself is a symlink outside root. Mitigation: `realpath` the parent and assert containment of the parent, not just the lexical candidate. Rollback: revert TASK-101 commit.
- **RISK-002:** Wiring content-state hooks into the queue could introduce a crash in the main render path. Mitigation: wrap hooks in try/catch + `logWarning`; queue persistence stays independent. Rollback: revert TASK-201.
- **RISK-003:** Changing batch writes to canonical layout changes the on-disk shape batch items previously wrote (orphaned `contents/*.json`). Mitigation: legacy flat fragments left in place are simply ignored by `loadDirEntries`; no migration needed for MVP. Rollback: revert TASK-301.
- **RISK-004:** Duplicate-enqueue guard may reject legitimately re-rendered content. Mitigation: guard only applies to `waiting`/`rendering` (active) jobs; completed/failed content can be re-enqueued. Rollback: revert TASK-202.
- **RISK-005:** Root-alignment could change where existing logs/settings were written for users with custom `workspacePath`. Mitigation: preserve `cwd/workspace` default; treat aligned root as the intended semantics per REQ-004. Rollback: revert TASK-401.
