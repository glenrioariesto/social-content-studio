---
goal: Remediate security and spec-compliance gaps in the Foundation Stabilization implementation
version: 1.0
date_created: 2026-08-24
last_updated: 2026-08-24
owner: Glen Rio
status: "Planned"
tags: ["refactor", "security", "clean-code", "ipc", "confinement"]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

A two-axis code review of the Foundation Stabilization implementation (`8809aec...HEAD`) surfaced two
**CRITICAL** security defects (OS command injection in the backup handlers and unguarded path traversal
via the renderer-supplied content `id`) plus several **REQUIRED** gaps (transition guard never invoked,
validation failures never logged, silent workspace fallback). The confinement guard itself is sound and
correctly applied to the generic `fs:*` handlers, but the higher-level `workspace:*` handlers and the
backup whitelist bypass it. This plan remediates all CRITICAL/REQUIRED findings and folds in the NIT-level
debt, without changing the approved data contracts (`LoadedEntry<T>`, ID format, etc.).

## 1. Traceability: Requirements & Constraints

- **SEC-01**: Every IPC channel that builds a path from client input MUST be confined; no shell string-building with caller data. (OWASP A03 Injection / STRIDE EoP)
- **SEC-02**: The renderer-supplied content `id` MUST be validated against a safe-name pattern and the constructed path MUST pass `assertInsideWorkspace` before any fs op. (SEC-001 scope / STRIDE Tampering)
- **SEC-03**: Confinement MUST be resistant to symlink escape (lexical resolve is insufficient). (STRIDE EoP residual)
- **REQ-006**: All status mutations MUST route through `assertLegalTransition` (CONTENT_STATUS_FLOW). (AC-011)
- **SEC-003**: Every validation failure and confinement refusal MUST be written to the app log. (§4.3)
- **REQ-004 / AC-008**: A missing/invalid configured `workspacePath` MUST NOT silently fall back; it MUST surface a guided/error state (the earlier clarification resolved this to the *restart-notice* model, not a full wizard).
- **SUPPLY-04**: One authoritative lockfile MUST be committed; CI installs frozen. (Supply-Chain Hygiene)
- **PRN-001**: Remove dead/misleading code (BACKUP_CHANNELS whitelist, unused `logRefusal`, `require('fs')` mix).
- **CON-001**: Settings persistence MUST use atomic write, consistent with content/template/account docs.
- **CON-002**: Keep the approved `LoadedEntry<T>` and durable-ID contracts unchanged.

## 2. Implementation Steps

> **⚠️ EXECUTION DIRECTIVE FOR AI AGENTS (`/sdlc-write-code`):**
> You MUST execute this plan phase by phase. Run the specific VERIFY task at the end of each phase, then STOP and wait for explicit user approval before the next phase. DO NOT SKIP PHASES.

### Implementation Phase 1: Security Remediation (Critical)

- **GOAL-001:** Close the two command-injection / path-traversal RCE vectors and the symlink escape.

| Task ID  | Description (Exact File Paths & Micro-Testing) | Ref ID  | Completed | Date |
| -------- | ----------------------------------------------- | ------- | :-------: | :--: |
| TASK-101 | `src/main/ipc/backup.ts`: replace the `execSync("powershell -Command \"...${outputPath}...\"")` / `zipPath` interpolation in `backup:export` / `backup:import` with a pure-Node archive library (`adm-zip`) — no shell spawned. Confine `outputPath`/`zipPath` via `assertInsideWorkspace(root, p, channel)` BEFORE handing to the library. Remove the `BACKUP_CHANNELS` exemption in `src/main/ipc/filesystem.ts` (it is dead — backup handlers never call `guardOrThrow`). | SEC-01, PRN-001 | [ ] | |
| TASK-102 | `src/main/services/path-guard.ts`: after lexical containment passes, call `fs.realpath` (or `open` with `O_NOFOLLOW`) on the resolved candidate and re-verify `realPath.startsWith(rootPrefix)`. Add a regression test in `tests/services/path-guard.test.ts` that plants a symlink pointing outside the root and asserts refusal. | SEC-03 | [ ] | |
| TASK-103 | `src/main/ipc/filesystem.ts`: harden `workspace:get-content`, `workspace:update-content`, `workspace:delete-content`, `workspace:create-content` — validate `id` against `^content-[\w-]+$` (reject `/`, `\`, `..`) AND pass the final constructed path through `assertInsideWorkspace(getWorkspaceRoot(), constructedPath, channel)` before any `readFile`/`writeFile`/`rm`/`stat`. `rm` MUST NOT use `recursive:true, force:true` with an unvalidated id. | SEC-02 | [ ] | |
| TASK-104 | `src/main/ipc/filesystem.ts` `getWorkspaceRoot()`: remove the silent `join(process.cwd(),'workspace')` fallback for a missing/invalid `workspacePath`; instead throw a clear `AppError` (logged) so the renderer can show the restart-notice / guided state. Delete the misleading comment claiming the startup sweep routes to guided setup. | REQ-004, AC-008 | [ ] | |
| TASK-10X | **VERIFY**: `bun test` (all green, incl. new symlink + id-traversal tests) and `bun run build`. Manually confirm: a crafted `id='../../../etc/passwd'` to `get-content` is refused; `delete-content` with `id='..'` is refused; backup export to a path containing a single quote does not execute injected PowerShell. | - | [ ] | |
| TASK-10Y | **APPROVAL**: 🛑 Wait for explicit user confirmation to proceed to Phase 2 | - | [ ] | |

### Implementation Phase 2: Spec Compliance & Logging

- **GOAL-002:** Wire the transition guard into handlers and log validation/refusal events per SEC-003.

| Task ID  | Description (Exact File Paths & Micro-Testing) | Ref ID  | Completed | Date |
| -------- | ----------------------------------------------- | ------- | :-------: | :--: |
| TASK-201 | `src/main/ipc/filesystem.ts` `workspace:update-content`: read `existing.status`, call `assertLegalTransition(existing.status, merged.status)` before `atomicWriteJson`; on rejection, let `safeIpcMain` return the explanatory error. Route `startupSweep` (rendering→failed) through the same guard (legal edge). Add a test asserting an illegal status update is rejected. | REQ-006 | [ ] | |
| TASK-202 | `src/main/ipc/filesystem.ts` `loadEntry()`: on `JSON.parse` throw or validator rejection, call `logError`/`logInfo` with `{ channel, file, issues }`. In `guardOrThrow`, invoke `logRefusal` (or log the original `AppError`'s `{channel, requested}`) so refusals record the path under the `FS_PERMISSION_DENIED` code (do not drop it in `safe-handler`). Remove the now-unused `logRefusal` stub only if it is replaced by a real call. | SEC-003, PRN-001 | [ ] | |
| TASK-203 | `src/main/ipc/backup.ts` `settings:write`: persist `settings.json` via `atomicWriteJson` (temp + rename), consistent with the other JSON docs. Keep the existing `workspacePath` exists+isDirectory validation and `requiresRestart` flag. | CON-001 | [ ] | |
| TASK-20X | **VERIFY**: `bun test` + `bun run build`. Confirm a log record is emitted for (a) a corrupt `content.json` and (b) a confinement refusal. | - | [ ] | |
| TASK-20Y | **APPROVAL**: 🛑 Wait for explicit user confirmation to proceed to Phase 3 | - | [ ] | |

### Implementation Phase 3: Hygiene & Nits

- **GOAL-003:** Clear dead/misleading code, fix the ffmpeg label, and commit a lockfile.

| Task ID  | Description (Exact File Paths & Micro-Testing) | Ref ID  | Completed | Date |
| -------- | ----------------------------------------------- | ------- | :-------: | :--: |
| TASK-301 | `src/main/ipc/backup.ts` `settings:validate-ffmpeg`: rename the `executable` field to `isFile` (honest); optionally verify it is actually ffmpeg via `spawn('--version')` exit-code check. Update `src/renderer/src/pages/SettingsPage.tsx` copy accordingly. | PRN-001 | [ ] | |
| TASK-302 | `src/main/ipc/filesystem.ts`: replace `require('fs').readFileSync` in `getWorkspaceRoot` with the already-imported `readFileSync`; convert `loadEntry`/`startupSweep` to the async `readFile` (fs/promises) to avoid blocking the main thread. | PRN-001 | [ ] | |
| TASK-303 | Repo root: generate and commit `bun.lockb`; document `bun install --frozen-lockfile` for CI. No dependency versions change. | SUPPLY-04 | [ ] | |
| TASK-30X | **VERIFY**: `bun test` + `bun run build` + `bun run typecheck` all green; `bun.lockb` present and tracked. | - | [ ] | |
| TASK-30Y | **APPROVAL**: 🛑 Wait for explicit user confirmation | - | [ ] | |

## 3. Structural Remedies & Alternatives

- **ALT-001 (backup):** Keeping `execSync` + whitelisting was rejected because the whitelist is dead code and string interpolation of caller data into a shell is inherently injectable. Pure-Node `adm-zip` removes the shell entirely — preferred.
- **ALT-002 (id confinement):** Validating `id` against a regex alone was rejected as insufficient (an absolute/other-drive id could still slip); combining the safe-name regex WITH a post-construction `assertInsideWorkspace` check is defense-in-depth.
- **ALT-003 (symlink):** Lexical-only resolution was retained initially for simplicity but is rejected as a final state once the app imports untrusted content; `realpath` re-check closes the TOCTOU.

## 4. Dependencies

- **DEP-001:** `adm-zip` (pure-Node zip, no native deps, no shell) — added to `dependencies` to replace `execSync` PowerShell archiving.

## 5. Files Affected

- **FILE-001:** `src/main/ipc/backup.ts` — remove execSync; add adm-zip; atomic settings write; honest ffmpeg label.
- **FILE-002:** `src/main/ipc/filesystem.ts` — id confinement; realpath check call site; transition guard in update-content; logging in loadEntry/guardOrThrow; remove BACKUP_CHANNELS + silent fallback; async reads.
- **FILE-003:** `src/main/services/path-guard.ts` — symlink `realpath` re-check.
- **FILE-004:** `src/renderer/src/pages/SettingsPage.tsx` — ffmpeg label copy.
- **FILE-005:** `tests/services/path-guard.test.ts`, `tests/services/lifecycle.test.ts`, `tests/services/id.test.ts` (or new `workspace.test.ts`) — new symlink / id-traversal / illegal-transition tests.
- **FILE-006:** `bun.lockb` — newly committed lockfile.

## 6. Testing Strategy

- **TEST-001:** Path-traversal: `id='../../../etc/passwd'` to `get-content`/`delete-content` is refused by the guard.
- **TEST-002:** Symlink escape: plant a symlink inside the workspace pointing outside; assert refusal after `realpath`.
- **TEST-003:** Illegal transition: `update-content` from `idea`→`posted` is rejected; legal `rendering`→`failed` (startup sweep) is allowed.
- **TEST-004:** Backup: exporting to a path containing a single quote does NOT execute injected PowerShell (no shell spawned).
- **TEST-005:** Logging: a corrupt `content.json` produces a `kind: invalid` entry AND a log record; a confinement refusal logs `FS_PERMISSION_DENIED` with the requested path.

## 7. Risks & Rollback Plan

- **RISK-001:** `adm-zip` API mismatch — mitigate by pinning a known version; rollback = revert FILE-001 to `execSync` (temporary, pre-fix state) while a fix is prepared.
- **RISK-002:** Over-strict `id` validation could reject legitimately-generated ids — mitigate by testing the real `generateContentId` format against the regex in TEST-001.
- **RISK-003:** `realpath` on Windows may behave differently for junctions — cover with TEST-002 on the target OS.
- **ROLLBACK:** every phase is independently committable; if a phase's VERIFY fails, `git revert` that phase's commit and report.
