---
goal: Refactor code health — remove dead parallel architecture, unify validation, consolidate renderer data/UI duplication
version: '1.1'
date_created: 2026-09-13
last_updated: 2026-09-13
owner: dev
status: 'Completed'
tags: refactor, architecture, cleanup, contract-consolidation
---

# Implementation Plan — Code Health Audit Refactor v1.0

> **EXECUTION DIRECTIVE (`/sdlc-write-code`):** execute phases in order; run each phase's VERIFY, commit per phase, then continue. Do not skip VERIFY/APPROVAL gates.

> **EXECUTION STATUS (2026-09-13):** Phases 1–4 executed and verified (`bun run verify` green; 77 tests). Phase 5 (contract hygiene + render-status conformance) executed and verified — TASK-501..507 done, TASK-508 (approval) superseded by user instruction to complete all gaps.

## 0. Decisions locked in review (resolve audit findings)`

- **DEC-01 (approved):** Delete `src/main/modules/`, `src/main/repositories/`, `src/main/infra/` entirely. Live `src/main/ipc/*` + `services/*` remain the source of truth (tests target them; live handlers are more complete).
- **DEC-02 (approved):** `REPLIZ_ID_PATTERN` canonical = **24-hex ObjectId** as defined in `packages/shared/src/domain.ts:57`. Main-process validation must align to shared (currently `ipc-handler.ts:5` uses 1-64 alnum). This is the only behavior change in this plan; treat as High Risk (see RISK-001).

## 1. Requirements & Constraints

- **REQ-001**: No change to content status flow / `CONTENT_STATUS_FLOW`; every status mutation still passes `assertLegalTransition`.
- **REQ-002**: Every cross-boundary change keeps `src/main/ipc/*`, `src/preload/index.ts`, and `src/renderer/src/lib/electron.d.ts` synchronized.
- **REQ-003**: Renderer must not import Node/Electron; all access via `window.electron`.
- **REQ-004**: Path confinement (`assertInsideWorkspace` + realpath re-check + SAFE_ID) stays on every path IPC channel.
- **REQ-005**: Every phase leaves `bun test` green; new logic ships focused tests (micro-level mandate).
- **SEC-001**: No shelled commands; backup remains adm-zip; credential vault per ADR-0004 untouched.
- **CON-001**: File-backed JSON only; no DB/cloud (MVP rule).
- **CON-002**: Do not invent `scheduled` status, landscape YouTube preset, or `Content.platform` field.

## 2. Implementation Steps

> Execute phase by phase. Run the VERIFY task at the end of each phase, then **STOP and WAIT** for explicit user approval before the next phase.

### Implementation Phase 1 — Foundations: remove dead architecture + unify validation

- GOAL-001: Eliminate orphaned layers and make `packages/shared` the sole owner of ID-validation rules, with zero behavior change to live content/account/render flows (except DEC-02).

| Task     | Description                                                             | Ref ID  | AC Ref | Dep       | Files | Completed | Date |
| -------- | ----------------------------------------------------------------------- | ------- | ------ | --------- | ----- | --------- | ---- |
| TASK-101 | Delete `src/main/modules/` (content/account/render), `src/main/repositories/`, `src/main/infra/`. No runtime consumer exists (`index.ts` never calls `init*Module`). | DD-1 | AC-101 | - | 7 deleted | | |
| TASK-102 | Consolidate ID validation into `packages/shared/src/domain.ts` (already has `SAFE_ID_PATTERN` + 24-hex `REPLIZ_ID_PATTERN`). Delete local regex copies: `SAFE_ID_PATTERN`/`assertSafeId`/`REPLIZ_ID_PATTERN`/`assertReplizId` literal patterns in `ipc-handler.ts:4-5,7-17` and `filesystem.ts:18-23`. Reimplement `assertSafeId`/`assertReplizId` in `ipc-handler.ts` delegating to shared `isSafeId`/`isReplizId` so `accounts.ts` call sites need no change. Update `shared/domain.ts` `REPLIZ_ID_PATTERN` export source (already 24-hex). | DD-3, DEC-02 | AC-102 | TASK-101 | shared/domain.ts, ipc-handler.ts, filesystem.ts | | |
| TASK-103 | Add focused tests: `isSafeId` (traversal `..` rejected, safe chars accepted), `isReplizId` (24-hex accepted incl. uppercase via `/i`; 23/25-hex, `-`/`_`, empty rejected). Assert `account:create`/`update` still reject invalid ids via guard (confinement suite). | DD-3 | AC-103 | TASK-102 | tests/shared/*.test.ts, tests/services/*.test.ts | | |
| TASK-104 | **VERIFY**: `bun run typecheck && bun test`. Grep `src tests` for `modules/|repositories/|infra/` → 0 hits. | - | - | - | - | | |
| TASK-105 | **APPROVAL**: Wait for explicit user confirmation to proceed to Phase 2. | - | - | - | - | | |

### Implementation Phase 2 — Renderer data layer

- GOAL-002: Kill the 6-copy async-hook skeleton and the vestigial Zustand stores; every hook shares one `useDocument` primitive and one IPC-call idiom.

| Task     | Description                                                             | Ref ID  | AC Ref | Dep       | Files | Completed | Date |
| -------- | ----------------------------------------------------------------------- | ------- | ------ | --------- | ----- | --------- | ---- |
| TASK-201 | NEW `src/renderer/src/hooks/useDocument.ts`: `useDocument<T>({ fetch, reshape?, deps? })` → `{ data, loading, error, reload }`; plus exported `validEntries<T>(entries)` helper (one canonical copy of the LoadedEntry filter). | DD-2, DD-4 | AC-201 | - | 1-2 | | |
| TASK-202 | Migrate `useAccounts` + `useContents` to `useDocument`; keep quarantined extraction in `useContents`; DROP writes into `content-store`/`app-store` items (keep `activeAccountId` slicing in `app-store`); delete 4 verbatim `validEntries` copies. | DD-2 | AC-202 | TASK-201 | useDocument, useAccounts, useContents, QuarantineCard import | | |
| TASK-203 | Migrate `useTemplates`, `useResources`, `useRenderQueue`, `useAgent` to `useDocument` + `callIpc`; surface errors everywhere (fix silent `useTemplates` failure path); remove 11 `as any` casts (incl. `useResources.ts:21,37` `resource.download` via bridge — superseded by TASK-402 typed API) and the `requireBridge` dead imports. | DD-2, DD-4 | AC-203 | TASK-201 | 4 hooks + lib/ipc-call.ts | | |
| TASK-204 | Delete `render-store`, `template-store`, `content-store`; remove re-exports in `app-store.ts:38-39`; delete `useWorkspaceSync.ts`. Fix `ContentCreationWizard` (`addContent` store write) → call `useContents().reload()` via `onCreated` callback from `ContentPage`. | DD-4 | AC-204 | TASK-203 | stores/*.ts, app-store, useWorkspaceSync, ContentCreationWizard, ContentPage | | |
| TASK-205 | **VERIFY**: `bun run typecheck && bun test`; manual smoke of dashboard/content/queue/agent pages (lists load, create reflects immediately). | - | - | - | - | | |
| TASK-206 | **APPROVAL**: Wait for explicit user confirmation to proceed to Phase 3. | - | - | - | - | | |

### Implementation Phase 3 — UI primitives & styling

- GOAL-003: Replace repeated className bundles with shared primitives; single source for status/account colors.

| Task     | Description                                                             | Ref ID  | AC Ref | Dep       | Files | Completed | Date |
| -------- | ----------------------------------------------------------------------- | ------- | ------ | --------- | ----- | --------- | ---- |
| TASK-301 | NEW `src/renderer/src/components/ui/`: `Card`, `Button`, `Input`/`Textarea`/`Select`, `Modal`, `ConfirmDialog`, `LoadingState`, `EmptyState`, `ErrorState` (retry prop), `StatusDot`. Wire `cn()` (`lib/utils.ts:4`, uses existing clsx+tailwind-merge) into primitives. | DD-5 | AC-301 | - | 8-9 new | | |
| TASK-302 | Adopt primitives in DashboardPage, ContentPage, ContentDetailPage, AccountsPage. Replace `rounded-xl border-zinc-800/…` card shells, input bundles, `py-20` loading/empty blocks, and `py-20`+icon-empty patterns; unify status coloring via `StatusBadge`/`StatusDot` (fix inconsistent hue `ready`/`rendering`); use `ACCOUNT_COLORS` from `packages/shared/src/template.ts:51` (delete ContentCard/AccountCard/DashboardPage color maps one-by-one); add `ConfirmDialog` to `ContentDetailPage` delete (replace `window.confirm`). | DD-5 | AC-302 | TASK-301 | 4 pages + ContentCard/AccountCard/StatusBadge | | |
| TASK-303 | Adopt primitives in TemplatesPage, AssetsPage, RenderQueuePage, CalendarPage, LogsPage, SettingsPage, ResourcesPage, BatchRenderPage, AgentStudioPage: card/input/loading-empty/error shells; `ConfirmDialog` for TemplatesPage & AssetsPage deletes (currently unconfirmed); unify status/account colors to shared maps; sort `DashboardPage`/`CalendarPage` duplicated account-color map into shared usage. | DD-5 | AC-303 | TASK-301 | 9 pages | | |
| TASK-304 | **VERIFY**: `bun run typecheck && bun test`; manual pass: dark styling consistent, delete flows confirm, empty/loading states render. | - | - | - | - | | |
| TASK-305 | **APPROVAL**: Wait for explicit user confirmation to proceed to Phase 4. | - | - | - | - | | |

### Implementation Phase 4 — Contract realignment + docs

- GOAL-004: Reconcile template types, bridge contract, dead channels, and architecture doc with implemented reality.

| Task     | Description                                                             | Ref ID  | AC Ref | Dep       | Files | Completed | Date |
| -------- | ----------------------------------------------------------------------- | ------- | ------ | --------- | ----- | --------- | ---- |
| TASK-401 | Unify template contracts: renderer and bridge consistently use one type. Prefer `TemplateDefinition` (`packages/shared/src/template.ts`, has `variables`/`layers`) for public template data; adjust `Template` (`packages/shared/src/index.ts:83`) usage or align its fields; remove the `as any` patch in `useWorkspaceSync` (deleted TASK-204) and `template-store` divergence. Keep `validateTemplate` in sync with chosen type. | DD-6 | AC-401 | TASK-204 | shared/index.ts, shared/template.ts, shared/validators.ts, electron.d.ts, useTemplates, TemplatesPage | | |
| TASK-402 | Add `resource` sub-API (`list`, `download`, `upload`, `delete`) to `src/preload/index.ts` + `electron.d.ts` matching `src/main/ipc/resource.ts` channels; remove `(window.electron as any).resource` casts in `useResources`; expose-or-delete orphan channels `account:list-files` & `workspace:get-account` (`accounts.ts:164,169`) — expose `listFiles`/`getAccount` in preload if used by renderer, else delete handlers. | DD-6 | AC-402 | - | preload/index.ts, electron.d.ts, useResources.ts, accounts.ts | | |
| TASK-403 | Update `docs/ARCHITECTURE.md`: remove `modules/`/`repositories/`/`infra/` mentions, add actual `services/repliz`, `ipc/agent`, `ipc/repliz`, `modules` removal, single `app-store`, `useDocument` hooks, `ui/` primitives, agent/batch channels; refresh page count and directory tree. | DD-7 | AC-403 | all prior | docs/ARCHITECTURE.md | | |
| TASK-404 | **VERIFY (final gate)**: `bun run typecheck && bun test && bun run build`; `bun run verify`; then handoff `/sdlc-code-review` in a new session with this plan + discovery draft attached. | - | - | - | - | | |
| TASK-405 | **EXIT**: Close plan, record completion, save session memory via `memory-manager`. | - | - | - | - | | |

### Implementation Phase 5 — Contract hygiene & render-status conformance

- GOAL-005: Close the remaining audit gaps in one focused, non-migratory batch — pure resource helpers with tests, a shared `RenderJobSummary` type (and align the queue status vocabulary to the declared `waiting` contract), typed renderer settings/fs access, removal of unused main-only channels, and plan/architecture documentation updates.

| Task     | Description                                                             | Ref ID  | AC Ref | Dep       | Files | Completed | Date |
| -------- | ----------------------------------------------------------------------- | ------- | ------ | --------- | ----- | --------- | ---- |
| TASK-501 | Extract pure helpers from `src/main/ipc/resource.ts` into `src/main/services/resource-utils.ts` (`sanitizeFileName`, `parseResourceMeta`); use them in `readMetas`/download/upload/delete; add `tests/services/resource-utils.test.ts` (sanitize edge cases + meta resilience). | AUDIT | AC-501 | TASK-402 | resource-utils.ts (new), resource.ts, resource-utils.test.ts | | |
| TASK-502 | Add `RenderJobSummary` to `packages/shared/src/render.ts` (re-exported from `index.ts`); type `render:jobs` return in `main/ipc/render.ts` and `electron.d.ts`; align queue status vocabulary to the declared contract (`waiting`, not `queued`) across `render-queue.ts` (+ legacy `queued`→`waiting` remap on restore), `useRenderQueue.ts`, `RenderQueuePage.tsx`. | AUDIT | AC-502 | - | shared/render.ts (new), index.ts, render.ts, render-queue.ts, electron.d.ts, useRenderQueue.ts, RenderQueuePage.tsx | | |
| TASK-503 | Remove unused `(f: any)` casts in `LogsPage.tsx` (typed `fs.readdir` already available). | AUDIT | AC-503 | - | LogsPage.tsx | | |
| TASK-504 | Type `settings.read` in `electron.d.ts` as `AppSettings`; drop the `as unknown as AppSettings` cast in `SettingsPage.tsx`. | AUDIT | AC-504 | - | electron.d.ts, SettingsPage.tsx | | |
| TASK-505 | Delete unused main-only channels `account:list-files` & `workspace:get-account` (`accounts.ts`) — not exposed in preload, zero renderer usage (ASSUMPTION-002: expose-or-delete → delete). | DD-6, TASK-402 | AC-505 | - | accounts.ts | | |
| TASK-506 | Update `docs/ARCHITECTURE.md` header note with the Phase 4 realignment + IPC surface audit results. | DD-7 | AC-506 | all prior | docs/ARCHITECTURE.md | | |
| TASK-507 | **VERIFY (final gate)**: `bun run verify` green (typecheck node+web, full test suite, build). | - | - | - | - | | |
| TASK-508 | **APPROVAL**: Wait for explicit user confirmation or close the plan per TASK-405. | - | - | - | - | | |

## 3. Alternatives

- **ALT-001** Complete the `modules/` migration instead of deleting: rejected — live `ipc/*` is more complete and test-covered; migrating would rewrite targets of the existing test suite for no user value.
- **ALT-002** Keep 1-64 alnum REPLIZ pattern: rejected — `packages/shared` is the canonical source of truth (AGENTS.md) and real Repliz account ids are ObjectIds; 24-hex matches the `Account.replizId` type comment.
- **ALT-003** Full UI-primitive adoption in one task: rejected — >9 files exceeds task sizing; split into two batches (Phase 3 tasks 302/303) each still mergeable.

## 4. Dependencies

- **DEP-001**: `clsx`, `tailwind-merge`, `class-variance-authority` already in `package.json` deps (activate via `cn()`). No new packages.
- **DEP-002**: Electron `safeStorage`/ADR-0004 untouched by this plan.
- **DEP-003**: Existing `bun test` harness is the only verification gate; no new tooling.

## 5. Files

- **FILE-001**: deleted — `src/main/modules/content/content.module.ts`, `src/main/modules/account/account.module.ts`, `src/main/modules/render/render.module.ts`, `src/main/infra/storage.ts`, `src/main/repositories/index.ts`.
- **FILE-002**: shared — `packages/shared/src/domain.ts`, `packages/shared/src/index.ts`, `packages/shared/src/template.ts`, `packages/shared/src/validators.ts`.
- **FILE-003**: main — `src/main/ipc/ipc-handler.ts`, `src/main/ipc/filesystem.ts`, `src/main/ipc/accounts.ts`.
- **FILE-004**: preload/bridge — `src/preload/index.ts`, `src/renderer/src/lib/electron.d.ts`.
- **FILE-005**: renderer hooks — `useDocument.ts` (new), `useAccounts.ts`, `useContents.ts`, `useTemplates.ts`, `useResources.ts`, `useRenderQueue.ts`, `useAgent.ts`, `useTemplateEditor.ts`.
- **FILE-006**: renderer stores — `app-store.ts`, `content-store.ts`, `render-store.ts`, `template-store.ts` (3 deleted), `useWorkspaceSync.ts` (deleted).
- **FILE-007**: renderer ui — `src/renderer/src/components/ui/*` (new) + components/pages listed in Phase 3.
- **FILE-008**: docs — `docs/ARCHITECTURE.md`.

## 6. Testing

- **TEST-001**: micro-level — new `tests/shared/` + `tests/services/` cases for `isSafeId`/`isReplizId` + guard integration (TASK-103); hook-migration behavior verified by existing page smoke + typecheck (no renderer test harness exists yet — flag as known limitation).
- **TEST-002**: macro-level — `bun run typecheck && bun test` after each phase; full `bun run verify` at final gate.

## 7. Risks & Assumptions

- **RISK-001** *(High)*: DEC-02 (24-hex) rejects previously-stored non-24-hex `replizId`. Mitigation: TASK-103 audits `workspace/accounts/*/account.json`; any non-conforming value reported to user before confirming — normalization or legacy-lenient exception decided then.
- **RISK-002**: Removing `content-store` write may change list-refresh timing for newly created content. Mitigation: TASK-204 adds explicit `onCreated → reload()` wiring.
- **RISK-003**: UI adoption touches many files; a className regression is possible. Mitigation: per-batch typecheck + manual smoke; no subjective "polish" allowed (ACs are boolean).
- **RISK-004**: A dynamic/indirect reference to deleted layers could survive grep. Mitigation: `bun run build` + `bun test` at VERIFY gates.
- **ASSUMPTION-001**: `Account.replizId` values are plain Mongo ObjectIds in real usage (per type comment). `[Out of scope if not]`.
- **ASSUMPTION-002**: No live user relies on `account:list-files`/`workspace:get-account` (not exposed in preload) — TASK-402 decides expose-vs-delete.
- **ASSUMPTION-003**: Renderer has no test harness; hook refactor correctness rests on typecheck + manual smoke + main-side `loaded-entry` semantics. `[Known limitation]`.

## 8. Related Specifications / Further Reading

- `docs/discovery-draft-20260913-0200-code-health-audit.md` (audit that produced this plan; `DD-1..7` refs above)
- `docs/ARCHITECTURE.md` (will be updated by TASK-403)
- `docs/adr/0001-backup-confinement-whitelist.md`, `docs/adr/0004-repliz-credential-vault.md`

## 9. Rollback / Recovery Plan

- Each phase is committed independently. Rollback a phase with `git revert <phase-commit>` (or `git reset --hard` pre-phase tag). Because Phase 1 deletes files, a failed gate is recoverable via git checkout of the deleted paths; no schema/data migration exists (JSON shape unchanged). For DEC-02 data risk, revert `ipc-handler.ts`/`shared/domain.ts` commit to restore lenient validation.