# Traceability Audit Report — Foundation Stabilization

## Audit Report [Review Iteration 1]

- **Date:** 2026-09-15
- **Scope:** `spec/spec-architecture-foundation-stabilization.md` (v1.0, clarified 93/100) vs the implementation on `main` (`da950f6`, `5ab8f4e`).
- **Method:** Three parallel evidence passes — (1) main services & IPC, (2) renderer UI states, (3) test-suite coverage — cross-checked against source by the authoring agent.
- **Verification basis:** `bun run verify` green at 127 tests / 0 fail (2 consecutive runs), typecheck node+web, electron-vite build OK.

## Readiness Score

| Criterion | Weight | Score | Note |
|-----------|--------|-------|------|
| Completeness | 40% | 35/40 | All REQ/SEC/CON present in code; AC-014 only partial, SEC-002 exceeded |
| Clarity | 30% | 27/30 | One doc-vs-code deviation (SEC-002) + AGENTS.md path drift (safe-handler location) |
| Alignment | 30% | 24/30 | Backup whitelist deviates by hardening; shutdown confirm UI missing |

**Readiness Score: 86/100** — implementation is viable; findings are actionable gaps, not blockers.

## Requirement Verification Summary

| ID | Verdict | Evidence (code) | Coverage (tests) |
|----|---------|-----------------|------------------|
| REQ-001 (GH-001) | VERIFIED | `src/main/services/id.ts:33-53` | COVERED `tests/services/id.test.ts:18,25,38` |
| REQ-002 (GH-003) | VERIFIED | `packages/shared/src/validators.ts`, `loaded-entry.ts`; `src/main/ipc/filesystem.ts:22-63,245-257` | COVERED `filesystem-helpers.test.ts:61,75` + `tests/lib/entries.test.ts:13` |
| REQ-003 | VERIFIED | `services/persistence.ts:11-35` | COVERED `tests/services/persistence.test.ts` |
| REQ-004 (GH-004) | VERIFIED | `workspace-root.ts:7,19-54`; `backup.ts:82-139` | COVERED `settings-write/status.test.ts` |
| REQ-005 | VERIFIED (code) | `backup.ts:141-153` | **MISSING** — zero tests |
| REQ-006 (GH-006) | VERIFIED | `lifecycle.ts:11-21`; 8 call sites incl. `filesystem.ts:155,293`, `render.ts:45,64`, `agent.ts:79,98`, `batch.ts:116,121` | COVERED `lifecycle.test.ts:16,24,31` |
| REQ-007 (GH-007) | VERIFIED | `LoadingState.tsx` (10 s escape); pages table §UI | PARTIAL (4 pages use inline banners, 2 missing formal states) |
| REQ-008 (GH-005) | VERIFIED | `package.json` `test`/`verify` scripts | COVERED (127 tests, <2 min) |
| SEC-001 | VERIFIED | `path-guard.ts:25-77` wired via `guardOrThrow`, `confineRenderPath`, batch/resource/account helpers | COVERED `path-guard.test.ts` + `fs-confinement.test.ts` |
| SEC-002 | VERIFIED (exceeded) | backup channels now ENFORCE guard (`backup.ts:21,40`); whitelist removed (PRN-001) | PARTIAL — `backup:export` untested functionally |
| SEC-003 | VERIFIED | refusals/log via `logError`/`logInfo`; logs view exists | PARTIAL — log emission not asserted in tests |
| SEC-004 | VERIFIED | `docs/ARCHITECTURE.md` documents residual relaxations | n/a |
| SEC-005 | VERIFIED | preload-only bridge; 0 Node imports in renderer | n/a (grep, 0 hits) |
| CON-001..005 | VERIFIED | no deps; shared types source of truth; layout preserved; error model reused; seeded data readable | — |
| AC-001..014 | see AC table below | — | — |

## Acceptance Criteria Verification

| AC | Verdict | Notes |
|----|---------|-------|
| AC-001 (ID unique after delete/re-create) | COVERED | `id.test.ts:25` (10 dirs), collision-retry `:38`; post-deletion is implicit |
| AC-002 (5 in one second) | PARTIAL | 10 rapid IDs `id.test.ts:25` prove uniqueness; "no partial records" implied via atomic write, not end-to-end asserted |
| AC-003 (confinement + log) | PARTIAL | refusal paths covered; log-channel/path emission NOT asserted (mock no-ops `logError`) |
| AC-004 (export outside ws + log) | MISSING | `backup:export` has zero functional test |
| AC-005/006 (quarantine, siblings, no defaults) | COVERED | `filesystem-helpers.test.ts:61-72`; invalid entries carry id/file/issues |
| AC-007 (`requiresRestart`) | PARTIAL | path + validation asserted; `requiresRestart:true` field never asserted |
| AC-008 (guided setup) | COVERED | `settings-status.test.ts` (5 tests) |
| AC-009/010 (suite + mutation) | PARTIAL | suite runs; timing <2 min observed; mutation sensitivity proven in-session via flaky-race fix |
| AC-011 (permitted-only transitions) | PARTIAL | main-side guard coded+tested; UI offers only next statuses, EXCEPT AgentStudioPage (all statuses, dev-only) |
| AC-012 (startup sweep) | VERIFIED | `filesystem.ts:140-167` + `render-queue.ts:94-123`; retry path legal |
| AC-013 (async states) | PARTIAL | 10/14 pages use shared components; see UI gaps |
| AC-014 (shutdown confirm) | **GAP** | `before-quit` (`index.ts:108-112`) calls `renderQueue.shutdown()` without renderer prompt listing in-flight jobs |

## Test-Coverage Gaps (priority order)

1. **REQ-005 / `settings:validate-ffmpeg` — zero tests.** Three branches (`!exists`, `!isFile`, spawn result) unexercised. Add a small IPC test with mocked `dialog`/`electron` (pattern: `tests/main/settings-status.test.ts`).
2. **AC-004 / `backup:export` — zero functional tests.** Zip creation + `logInfo` + output path untested (only static `confinement.test.ts:48` and import zip-slip `zip-slip.test.ts` exist).
3. **AC-003 / log-emission on refusal — not asserted.** All confinement tests stub `logError` to no-op. A test asserting the log was called with channel+path would lock SEC-003.
4. **AC-007 / `requiresRestart` field — one-line assertion gap** in `settings-write.test.ts:73-85`.

## UI Gaps (REQ-007 / AC-013, same-review scope)

- CalendarPage: no empty state (month grid always renders).
- BatchRenderPage: no error state component (failures surface only via toast).
- SettingsPage, RenderQueuePage, AgentStudioPage: inline banners/spinners instead of shared `LoadingState`/`ErrorState`.
- ResourcesPage: delete action lacks `ConfirmDialog` (inconsistent with ContentDetail/Templates/Assets).
- AgentStudioPage: status select offers all 7 statuses (main still validates; mark explicitly dev-only or restrict to `allowedNextStatuses`).

## Documented Deviations (accepted)

- **SEC-002 exceeds spec:** backup `export`/`import` enforce the Confinement Guard instead of bypassing it with logging. This is a deliberate hardening (PRN-001, from the code-review remediation). Default export (no explicit path) lands under `root/` inside the workspace, so the standard workflow is unaffected; only caller-supplied outside-workspace paths are refused. If cross-workspace backup is a product need, this needs a directed decision (new ADR scope), not an opportunistic change.
- **AC-014 partial:** quit cleans up in-flight jobs server-side but lacks the renderer confirmation dialog.

## Known Doc-vs-Code Drift (carry to next doc pass)

- Root `AGENTS.md` says the error model lives in `packages/shared/src/safe-handler.ts`; the actual file is `src/main/ipc/safe-handler.ts` (from earlier checkpoint). Spec §4.2 already points to the correct path.

## Actionable Follow-up (not blockers)

1. Add `settings:validate-ffmpeg` micro-tests (REQ-005).
2. Add `backup:export` functional test with log assertion (AC-004 + SEC-003).
3. Assert `requiresRestart:true` in `settings-write.test.ts` (AC-007).
4. Decide AC-014 confirmation dialog scope (product decision; medium UX risk).

All are additive, low-risk, and fail-safe. Top blockers: none.