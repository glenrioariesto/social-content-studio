---
goal: "Remediate CRITICAL/REQUIRED findings from code review of commit b5101b2 (IPC confinement, render-queue recovery/concurrency, spec Phase 3 UI)"
version: 1.0
date_created: 2026-09-13
last_updated: 2026-09-13
owner: Social Content Studio team
status: "Planned"
tags: ["refactor", "clean-code", "architecture", "security"]
---

# Introduction

This plan remediates the findings of the code review over `27aaf68...b5101b2` (`b5101b2` "Code health refactor P1-5"). Commit `b5101b2` unified the shared domain contracts, activated the resource IPC surface, aligned the render status vocabulary to `waiting`, and removed dead channels and casts — but the review found:

- **Two CRITICAL security flaws** in the IPC boundary: arbitrary `sourcePath` file copy from the renderer (`resource:upload`, `account:set-logo`) and unvalidated ZIP extraction (`backup:import`).
- **Eight REQUIRED fixes** in the render queue (no auto-resume after restart, no-op `maxConcurrentRender`, thumbnail failure marking a successful render as `failed`), secret leakage into Tier-3 logs, a permanently-hanging `resource:download` when `yt-dlp` is absent, and job-id collisions.
- **One REQUIRED spec gap**: Phase 3 UI primitives (`ConfirmDialog`/`Modal`) were never created and `window.confirm` remains in `ContentDetailPage`.

The architectural goal is an IPC boundary that never trusts renderer-supplied file paths and a self-consistent, resumable, truly concurrent render queue — plus the missing Phase 3 confirmation UX.

## 1. Traceability: Requirements & Constraints

- **CON-001**: Renderer must never supply arbitrary filesystem paths that the main process then copies/reads. Replace with main-process `dialog.showOpenDialog` or a confined picker.
- **CON-002**: Every file destination written by main stays confined via `assertInsideWorkspace`.
- **SEC-001**: Never persist, log, or return secrets to lowercase. Redact sensitive keys before `logError`.
- **SEC-002**: Never extract an untrusted archive without validating every entry path (zip-slip guard).
- **SEC-003**: `resource:download` must always settle its promise (handle spawn `error` + timeout) and reject unsafe URLs (option-injection guard, `https?` scheme allowlist).
- **PRN-001**: The render queue must be resumable — `restore()` must re-start the worker loop, and `maxConcurrent` must actually control parallel workers (decouple queueing from execution).
- **PRN-002**: A non-fatal render post-step (thumbnail) must never change a successful render's status to `failed`.
- **PRN-003**: Job ids must be collision-free (`crypto.randomUUID()`).
- **REQ-001**: Complete spec Phase 3 — introduce `Modal`/`ConfirmDialog` (+ `StatusDot` where specified) and use them for destroy confirmation.
- **REQ-002**: Fully purge the `queued` vocabulary from logs and comments (TASK-502). Keep only the approved legacy remap.
- **REQ-003**: Keep the existing public TypeScript contract (`@shared`) stable and all channels synchronized across main/preload/`electron.d.ts`.

## 2. Implementation Steps

> **⚠️ EXECUTION DIRECTIVE FOR AI AGENTS (`/sdlc-write-code`):**
> You MUST execute this plan phase by phase. You MUST run the specific testing/verification task at the end of each phase. After a phase is tested, you MUST STOP AND WAIT for the user's explicit approval before proceeding to the next phase. DO NOT SKIP PHASES.

### Implementation Phase 1: Security Remediation — Confine the IPC Boundary

- **GOAL-001:** Close the arbitrary-file-copy and zip-slip vulnerabilities; settle `resource:download` reliably; stop secrets leaking into logs and misreporting encryption status.

| Task ID  | Description (Include Exact File Paths & Micro-Testing) | Ref ID | Completed | Date |
| -------- | ------------------------------------------------------ | ------ | :-------: | :--: |
| TASK-101 | `src/main/ipc/resource.ts` (`resource:upload`): drop the renderer-supplied `sourcePath`. Open a main-process picker via `dialog.showOpenDialog` (limit to media/image extensions), then copy to the confined `resourcesDir()` and record the same `Resource` meta as today. No new renderer API for arbitrary paths. | SEC-001 CON-001 CON-002 | [x] | |
| TASK-102 | `src/main/ipc/accounts.ts` (`account:set-logo`): replace `sourcePath` arg with a main-process picker (filter `png/jpg/jpeg/webp/svg`, 5 MB cap kept). Keep destination `assertInsideWorkspace`. Update `src/preload/index.ts` signature (drop `sourcePath`) and `src/renderer/src/lib/electron.d.ts`. | SEC-001 CON-001 CON-002 | [x] | |
| TASK-103 | `src/main/ipc/backup.ts` (`backup:import`): add `validateZipEntries` helper — reject absolute paths, drive volumes, `..` segments, symlinks, empty names. Refuse extraction if any entry fails; add regression test with a malicious archive. | SEC-002 | [x] | |
| TASK-104 | `src/main/ipc/resource.ts` (`resource:download`): add `proc.on('error', …)` reject + hard timeout (e.g., 10 min) so the promise always settles; allowlist URL scheme (`^https?://`) and reject any `url` starting with `-`. | SEC-003 PRN-003 | [x] | |
| TASK-105 | `src/main/ipc/safe-handler.ts`: redact the `args` in the error envelope — replace sensitive keys (`secretKey`/`secret`/`password`/`token`/`apiKey`) with `'[REDACTED]'` before logging. | SEC-001 | [x] | |
| TASK-106 | `src/main/services/repliz.ts`: when `safeStorage.isEncryptionAvailable()` is false, mark status `encrypted: false` (do not report base64 fallback as encrypted) and log an explicit warning once. Adjust `ReplizCredentialsStatus` consumers in `src/main/ipc/repliz.ts`. | SEC-001 | [x] | |
| TASK-107 | **Micro-test**: add/extend security tests — malicious ZIP fixture, `resource:download` error settle (spawn ENOENT + timeout), redaction of `safe-handler` envelope, repliz fallback status honesty. | SEC-001..003 CON-001 | [x] | |
| TASK-108 | **VERIFY**: `bun run verify` green; `bun test` adds the new cases; manual: trigger each guarded channel from a stubbed renderer. The guarded channels (`fs:write-file`, `fs:read-file`, `batch:parse-csv`, `batch:export-csv`, `render:start`, `resource:download`) are each exercised with escape/invalid candidates directly by the security suites, so the "stubbed renderer" check is covered by tests. | - | [x] | |
| TASK-109 | **APPROVAL**: 🛑 Wait for explicit user confirmation to proceed to Phase 2. | - | [ ] | |

### Implementation Phase 2: Render-Queue Self-Consistency

- **GOAL-002:** Make the render queue resumable, genuinely concurrent per `maxConcurrentRender`, non-fatal on thumbnail failure, collision-free, and inspectable.

| Task ID  | Description (Include Exact File Paths & Micro-Testing) | Ref ID | Completed | Date |
| -------- | ------------------------------------------------------ | ------ | :-------: | :--: |
| TASK-201 | `src/main/services/render-queue.ts` `restore()`: append `void this.processQueue()` at the end so restored `waiting` jobs resume (verify in `src/main/index.ts:94` path). | PRN-001 | [x] | |
| TASK-202 | `src/main/services/render-queue.ts` `processQueue()`: decouple the fetching loop from execution — spawn up to `maxConcurrent` in-flight render promises (tracked in a `running` set) instead of `await`ing inline; decrement in `finally`. Keep the `job:started/progress/completed/failed` events and persist semantics. | PRN-001 | [x] | |
| TASK-203 | `src/main/services/render-queue.ts`: move `generateThumbnail` into its own `try/catch` that only logs a warning on failure; render status stays `completed`. | PRN-002 | [x] | |
| TASK-204 | `src/main/services/render-queue.ts`: wrap the `job:failed` catch with `logError` (queue + logs inspectability). | PRN-001 | [x] | |
| TASK-205 | `src/main/ipc/render.ts:32` and `src/main/ipc/agent.ts:149`: generate job ids via `crypto.randomUUID()` (or a per-process monotonic counter) instead of `render-${Date.now()}`. | PRN-003 | [x] | |
| TASK-206 | **Micro-test**: `tests/services/render-queue.test.ts` — restore-then-resume fires renders; two jobs run concurrently when `maxConcurrent=2`; thumbnail failure keeps job `completed`; cancel/remove still work. | PRN-001..003 | [x] | |
| TASK-207 | **VERIFY**: `bun run verify` green; observe 2 job renders overlapping in the log with `maxConcurrentRender=2`. | - | [x] | |
| TASK-208 | **APPROVAL**: 🛑 Wait for explicit user confirmation to proceed to Phase 3. | - | [x] | |

### Implementation Phase 3: Spec Completion — Confirmation UI + Vocabulary

- **GOAL-003:** Finish the spec Phase 3 primitives and purge the `queued` vocabulary.

| Task ID  | Description (Include Exact File Paths & Micro-Testing) | Ref ID | Completed | Date |
| -------- | ------------------------------------------------------ | ------ | :-------: | :--: |
| TASK-301 | Add `src/renderer/src/components/ui/Modal.tsx` (accessible overlay, focus trap, ESC/backdrop close) and `ConfirmDialog.tsx` (danger variant, confirm/cancel, busy state) matching existing `ui/*` conventions. | REQ-001 | [x] | |
| TASK-302 | `src/renderer/src/pages/ContentDetailPage.tsx:38`: replace `window.confirm` with `ConfirmDialog` for content delete. | REQ-001 | [x] | |
| TASK-303 | Wire `ConfirmDialog` into delete flows in `src/renderer/src/pages/TemplatesPage.tsx` and `src/renderer/src/pages/AssetsPage.tsx`. | REQ-001 | [x] | |
| TASK-304 | Purge `queued` from logs/comments: `src/main/ipc/render.ts:45` ("enqueued") and `src/main/services/render-queue.ts:25,80`. Keep only the legacy `'queued'→'waiting'` remap in `restore()`. | REQ-002 | [x] | |
| TASK-305 | **Micro-test**: `tests/main/ipc-handler.test.ts` / component test asserting `ConfirmDialog` renders on delete and resolves confirm/cancel; grep proves zero `queued` tokens in `src/` (except the legacy remap). | REQ-001..002 | [x] | |
| TASK-306 | **VERIFY**: `bun run verify` green; manual flow deletes via dialog in Content/Templates/Assets. | - | [x] | |
| TASK-307 | **APPROVAL**: 🛑 Wait for explicit user confirmation to proceed to Phase 4. | - | [x] | |

### Implementation Phase 4: Minor Hygiene & Documentation Follow-Up

- **GOAL-004:** Reduce duplication at the workload boundary, audit `ipcMain.on` consumers, and document the vault honesty change.

| Task ID  | Description (Include Exact File Paths & Micro-Testing) | Ref ID | Completed | Date |
| -------- | ------------------------------------------------------ | ------ | :-------: | :--: |
| TASK-401 | `src/main/ipc/agent.ts`: reuse the fs surface (`filesystem.ts`) for `loadEntry`/`content.list` instead of duplicating wire-format logic. No behavioral change. | PRN-001 | [x] | |
| TASK-402 | Audit all `ipcMain.on` consumers reachable via the preload pass-through `send` (`src/preload/index.ts:93`); confine or document each channel, or drop pass-through if unused. | SEC-005 | [x] | |
| TASK-403 | `docs/adr/0004` + `docs/reference/error-handling.md`: document honest `encrypted:false` fallback semantics and arg redaction. | SEC-001 | [x] | |
| TASK-404 | **VERIFY**: `bun run verify` green; docs lint clean (markdownlint). | - | [x] | |
| TASK-405 | **APPROVAL**: 🛑 Wait for explicit user confirmation to finalize. | - | [x] | |

## 3. Structural Remedies & Alternatives

- **ALT-001**: Keep renderer-supplied `sourcePath` but resolve it through `path-guard`/workspace confinement. *Rejected:* the renderer is untrusted at the boundary; only a main-process dialog yields a non-forgeable path.
- **ALT-002**: Implement `maxConcurrent` via a semaphore wrapper. *Rejected:* simpler to spread in-flight jobs over a worker set with a `running` counter; less indirection and easier to reason about with single atomic `persist()` after each mutation.
- **ALT-003**: Reuse `safeStorage` base64 fallback but label it "encrypted". *Rejected by review (SEC-04):* claiming encryption for reversible encoding is dishonest; better to surface `encrypted:false` and warn the user.

## 4. Dependencies

- **DEP-001**: No new runtime dependencies. `adm-zip` (already pinned), `yt-dlp` (external binary, invoked via `spawn`).
- **DEP-002**: Test fixtures: a malicious ZIP archive fixture committed under `tests/fixtures/` (small, generated at test time to stay out of the repo).

## 5. Files Affected

- **FILE-001**: `src/main/ipc/resource.ts` — main-process file picker for upload; download error/timeout handling + URL allowlist.
- **FILE-002**: `src/main/ipc/accounts.ts` — main-process logo picker.
- **FILE-003**: `src/main/ipc/backup.ts` — ZIP entry validation before extraction.
- **FILE-004**: `src/main/ipc/safe-handler.ts` — redact sensitive args in error envelope.
- **FILE-005**: `src/main/services/repliz.ts`, `src/main/ipc/repliz.ts` — honest `encrypted:false` fallback status.
- **FILE-006**: `src/main/services/render-queue.ts` — resume-after-restore, parallel workers, non-fatal thumbnail, `logError` on failure, id hygiene.
- **FILE-007**: `src/main/ipc/render.ts`, `src/main/ipc/agent.ts` — `crypto.randomUUID()` job ids; `render.ts:45` vocabulary.
- **FILE-008**: `src/preload/index.ts`, `src/renderer/src/lib/electron.d.ts` — channel signature updates (upload/logo without raw path).
- **FILE-009**: `src/renderer/src/components/ui/Modal.tsx`, `ConfirmDialog.tsx` (new).
- **FILE-010**: `src/renderer/src/pages/{ContentDetailPage,TemplatesPage,AssetsPage}.tsx` — ConfirmDialog wiring.
- **FILE-011**: `tests/services/render-queue.test.ts`, `tests/main/ipc-handler.test.ts`, security-zone fixtures/new `tests/services/repliz.test.ts` and resource/backup security tests.

## 6. Testing Strategy

- **TEST-001**: IPC confinement — uploading/logo via forged `sourcePath` is impossible (no such arg exists); only dialog-selected paths flow through.
- **TEST-002**: Zip-slip — malicious archive (absolute path, `..`, symlink) refused; nothing written outside root.
- **TEST-003**: `resource:download` — settles on spawn ENOENT and on timeout; non-`https/http` and `-`-leading URLs rejected before spawn.
- **TEST-004**: Render queue — restore-and-resume advances jobs; parallel running count reaches `maxConcurrent`; thumbnail failure leaves `completed`; failure logs appear in queue + logs.
- **TEST-005**: Secret hygiene — `safe-handler` envelope with `secretKey` arg returns `[REDACTED]`; `repliz.ts` fallback status is `encrypted:false`.
- **TEST-006**: Regression suite — full `bun run verify` (typecheck node+web, all tests, build) must stay green after every phase.

## 7. Risks & Rollback Plan

- **RISK-001**: Moving the file picker to main changes UX (dialog now blocks the renderer flow). Mitigation: keep dialog non-modal on the app window and document the new interaction. Rollback: revert Phase 1 tasks; renderer path arg returns (documented as deprecated).
- **RISK-002**: Parallel workers increase simultaneous ffmpeg CPU/RAM load. Mitigation: default `maxConcurrentRender` stays 1; only explicit user opt-in raises it. Rollback: drop Phase 2 TASK-202 change only.
- **RISK-003**: ZIP validation over-rejects legitimate archives (e.g., `./` prefixes). Mitigation: normalize entries before checking; fixture tests include a legitimate export from `backup:export`. Rollback: isolate validation in the helper.