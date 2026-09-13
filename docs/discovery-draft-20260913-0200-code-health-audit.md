---
title: Project Discovery & Architecture Summary — Code Health Audit
status: DRAFT (Phase 0)
date_analyzed: 2026-09-13
scope: clean-architecture assessment, redundancy detection, component reusability audit
---

# Project Discovery Summary

## 1. Project Overview

Social Content Studio is a **local-first Electron desktop application** that lets a solo creator manage multiple social-media brand accounts, author HTML-based content templates, organize local media assets, compose content items against those templates, and render final vertical videos through an FFmpeg-backed render queue. Publishing to social platforms is intentionally manual (copy/export/open-output-folder/mark-as-posted); there are no platform API integrations by design.

Core business value:

- **Content lifecycle management** — ideas progress through a strict status machine (`idea → draft → ready → rendering → ready-to-post → posted`, plus `failed` recovery). Every mutation passes through `assertLegalTransition`.
- **Multi-account workspaces** — accounts, templates, contents, and assets live as JSON/folder trees under `workspace/`.
- **HTML template composition** — templates pair HTML/CSS with a descriptor; content fills template variables.
- **Render queue** — FFmpeg jobs serialized behind `maxConcurrentRender`, resumable after interrupted shutdowns via a startup sweep.

This discovery draft was produced from a **code-health audit** (2026-09-13). Its purpose is to (a) record the current architectural reality — which has drifted from `docs/ARCHITECTURE.md` — and (b) hand off a prioritized remediation backlog so downstream SDLC phases do not build on top of duplicated or dead abstractions.

## 2. Technology Stack & Infrastructure

*(Reference: `docs/ARCHITECTURE.md` §2 and §4; findings below focus on gaps not covered there.)*

- **Core Framework/Language:** Electron 35 + TypeScript (strict, ESM), React 19 + React Router 7.
- **State Management:** Zustand 5 — but the store layer is **largely vestigial** (see §3). The dominant data-access pattern is per-hook local state.
- **Key Dependencies:** `@monaco-editor/react` (template editor), `chokidar` (workspace watcher), `adm-zip` (shell-free backup archive), `lucide-react` + Tailwind CSS 4 (styling), `class-variance-authority`/`clsx`/`tailwind-merge` (shipped but currently unused).
- **Infrastructure/DB:** None. File-backed JSON under `workspace/`; no database or cloud by MVP rule.
- **Build/Tooling:** electron-vite 3 + Vite 6; Bun as script runner; `bun test` harness (~11 test files). No CI/CD, no packaging pipeline.

## 3. Current Architecture Assessment

### Layer reality (observed, not documented in ARCHITECTURE.md)

| Layer | State |
|---|---|
| `packages/shared/src/` | **Canonical contract — healthy.** No dependencies; types, `CONTENT_STATUS_FLOW`, `LoadedEntry<T>`, validators, error envelope. |
| `src/main/services/` | **Well factored.** `path-guard` (confinement), `workspace-root`, `id`, `persistence`, `lifecycle`, `render-queue`, `render-engine`, `repliz` — single-responsibility, enforced transition/guard reuse. |
| `src/main/ipc/` | **Live handlers, per-domain files** (`filesystem`, `accounts`, `render`, `resource`, `batch`, `backup`, `agent`, `repliz`) registered through `safeIpcMain`. |
| `src/main/modules/` | **Orphaned duplicate architecture** — `content/`, `account/`, `render/` modules register the *same* channels as `ipc/*` but are **never initialized** (`init*Module` has no caller). |
| `src/main/repositories/` | **Dead interfaces** — repository contracts declared ("Phase 2"), imported by nothing. |
| `src/main/infra/storage.ts` | **StoragePort abstraction** used only by the orphaned modules; live code calls `fs/promises` directly. |
| `src/preload/index.ts` | **Healthy bridge** — namespaced `window.electron`, contextIsolation + sandbox on. Two main channels are un-exposed (`account:list-files`, `workspace:get-account`). |
| `src/renderer/src/stores/` | **Vestigial** — 4 near-identical Zustand stores; 3 have zero consumers; CRUD mutations unread. Only `activeAccountId` slicing is genuinely consumed. |
| `src/renderer/src/hooks/` | **Real data layer** — but 6 near-identical async skeletons + 4 verbatim `validEntries` copies. |
| `src/renderer/src/pages/components` | **Presentation-heavy duplication** — no shared UI primitives (`Card`, `Input`, `Modal`, `EmptyState`…); `cn()` exists but is unused. |

### Strengths

- **Enforced process boundary**: renderer never imports Node/Electron; everything crosses `window.electron`; `sandbox: true`, `contextIsolation: true`.
- **Path confinement is consistent and layered**: `assertInsideWorkspace` + `realpath` re-check + `SAFE_ID` validation on `workspace:*` handlers; backup no longer shells out.
- **Single canonical contract package** consumed by both processes — the right foundation for cross-boundary changes.
- **Robust writes**: `atomicWriteJson` (temp + rename), `LoadedEntry` quarantine for corrupt docs, status transition guard, startup sweep for interrupted renders.
- **Well-named, focused services**; error envelope (`{ success, data|error }`) is uniform across live main handlers.
- **Good reuse candidates already exist**: `StatusBadge`, `callIpc` + `userMessageFor`, `ErrorBoundary` + `onError`, `ContentCard`/`AccountCard`/`QuarantineCard`/`LivePreview`, and `ACCOUNT_COLORS` in shared.

### Tech Debt & Risks (ranked)

1. **Parallel dead architecture (highest impact).** `modules/`, `repositories/`, `infra/` duplicate live IPC responsibilities but are never wired into `src/main/index.ts`. Risk: a future engineer "activates" them → duplicate channel registration → unpredictable behavior; or fixes land in the dead copy and are silently ignored.
2. **Renderer duplication makes change expensive.** `validEntries` ×4, async-hook skeleton ×6, store boilerplate ×4, status/account color maps ×3–4 (some with *inconsistent hues* for the same status), ~24 duplicated card shells, ~8 duplicated input bundles, Monaco editor options duplicated in-file. Any branding or status-vocabulary change must be applied in many places.
3. **Contract drift across boundaries.**
   - `SAFE_ID_PATTERN` defined 3× (`shared/domain.ts`, `ipc-handler.ts`, `filesystem.ts`), `includes('..')` guard inconsistent.
   - `REPLIZ_ID_PATTERN` disagrees: shared = `/^[a-f0-9]{24}$/i` (ObjectId), main = `/^[A-Za-z0-9_-]{1,64}$/` — the same field validates differently per layer.
   - `Template` (`@shared/index`) vs `TemplateDefinition` (`@shared/template`) are both used in the renderer, patched with `as any` in `useWorkspaceSync`.
   - `electron.d.ts` declares no `resource` API, yet `useResources` calls `(window.electron as any).resource.download` — the typed bridge contract is eroded.
4. **Dead code inventory** (safe to remove once confirmed by tests): `toIPCResult`/`okResult`/`errResult`/`isResult` (errors.ts), `handleIPCCall` + `cn()` (renderer lib), `useWorkspaceSync` (never mounted), `useRenderStore` + all unread store CRUD.
5. **Inconsistent IPC-consumption idiom.** `callIpc` (the intended wrapper) is used by ~2 of ~11 call sites; the rest hand-roll `window.electron.*` + success checks, so error → toast → log consistency is not guaranteed (e.g., `useTemplates` never surfaces an error).
6. **Inconsistent delete-confirmation UX.** `window.confirm` used on `ContentDetailPage` only; `TemplatesPage`/`AssetsPage` delete without confirmation. No shared `ConfirmDialog`.
7. **Stale documentation.** `docs/ARCHITECTURE.md` does not cover `modules/`, `repositories/`, `infra/`, `agent`/`repliz` IPC, multi-store Zustand, or new hooks/pages. It must be re-mapped or engineers will navigate against a wrong map.

## 4. Operational Workflows

### Workflow A: Content creation & lifecycle

```
ContentCreationWizard (component)
  → useAccounts (hook: window.electron.workspace.getAccounts)
  → window.electron.workspace.createContent(data)          [preload]
     → safeIpcMain('workspace:create-content')             [main: ipc/filesystem.ts]
        → id.generateUniqueContentId(root/contents)
        → persistence.atomicWriteJson(<id>/content.json)
     ← { success: true, data: Content }
  → content-store.addContent(...)                          [DEAD: store is never read back]
```
Status changes route through `workspace:update-content`, which runs `mergeKnownFields` + `assertLegalTransition` before the atomic write. Interrupted renders are swept `rendering → failed` at startup.

### Workflow B: Render pipeline

```
RenderQueuePage → useRenderQueue → callIpc(window.electron.render.start/jobs)  [preload]
  → safeIpcMain('render:start') → renderQueue.addJob(...)  [services/render-queue]
  → renderEngine spawns FFmpeg, honors maxConcurrentRender
  → events render:progress/completed/failed → preload.on() → useRenderQueue
```
Concurrency and persistence live in `services/render-queue`; job views are typed in `ipc/render.ts`. Note `render:jobs` returns a hand-specified projection rather than the full `RenderJob` contract.

### Workflow C: Account management + Repliz linking

```
AccountsPage → useAccounts + app-store.activeAccountId
AccountEditor → window.electron.account.create/update/setLogo/getLogoUrl   [preload]
  → safeIpcMain('account:*') [ipc/accounts.ts] with assertSafeId + assertReplizId
Repliz: SettingsPage → window.electron.repliz.* → service repliz + credential vault (ADR-0004)
```
Dead duplicate `account:*` handlers exist in `modules/account/account.module.ts` (see §3 Debt #1).

## 5. Handoff Notes

### For /sdlc-plan-tasks / refactor planning

The remediation backlog below is execution-ready and ordered by impact. Any of these should be planned as vertical tracer-bullet tickets (main ↔ preload ↔ renderer ↔ tests together), not layer-by-layer:

1. **Remove or complete the parallel architecture** — decide global: delete `modules/`, `repositories/`, `infra/` (and their unused imports), or finish migrating `ipc/*` → modules and delete the old handlers. Never keep two implementations of one channel.
2. **Consolidate ID validation** into `packages/shared` (single `SAFE_ID_PATTERN`, single `REPLIZ_ID_PATTERN` — resolve the 24-hex vs 1-64-alnum conflict with product), and remove per-file regex copies.
3. **Extract a generic `useDocument`-style hook** with `{ fetch, reshape, deps }` → `{ data, loading, error, reload }`; delete `validEntries` copies and unify error handling (`callIpc` everywhere).
4. **Remove dead renderer code**: unused stores (or replace with `createEntityStore` factory), `useWorkspaceSync`, `handleIPCCall`, wire up `cn()`.
5. **Introduce shared UI primitives**: `Card`, `Input/Textarea/Select`, `Button`, `Modal`, `ConfirmDialog`, `LoadingState/EmptyState/ErrorState`, single `StatusDot`/account-color map (reuse `ACCOUNT_COLORS` from shared).
6. **Re-align typed contracts**: unify `Template` vs `TemplateDefinition`; add the `resource` API to `electron.d.ts` + preload; expose-or-delete `account:list-files`/`workspace:get-account`.
7. **Re-map and update `docs/ARCHITECTURE.md`.**

### For /sdlc-draft-prd (product boundaries to respect)

- **Must not** be "fixed" as opportunistic bonus work; each debt item needs its own PRD/spec/plan as the team sees fit.
- The **current public contract is the source of truth** per AGENTS.md: seven content statuses, three render presets (no landscape YouTube, no `scheduled`, no `platform` field). Any product change to these is a coordinated migration, not a local edit.
- `module`/`repository` cleanup is an **internal refactor only** — no user-visible behavior change expected, so a PRD may be bypassed for the pure-deletion tickets (Plan + Code only).

### Domain glossary proposals (CONTEXT.md — lazy-created on first explicit resolution)

No `CONTEXT.md` exists yet. Canonical terms used in this document and worth resolving deliberately:

- **Content lifecycle statuses**: `idea`, `draft`, `ready`, `rendering`, `ready-to-post`, `posted`, `failed`. *(Avoid: `scheduled`, `published`, `rendered`)*
- **Render job statuses**: `waiting`, `rendering`, `completed`, `failed` — distinct from content statuses.
- **LoadedEntry<T>**: discriminated `valid | invalid` document read; `InvalidEntry` surfaces as a "quarantine card".
- **Workflow types**: `manual-video`, `internet-video`, `product-video`. *(Avoid: `platform` on `Content`)*
- **Render presets**: `instagram-reels`, `tiktok`, `youtube-shorts`. *(Avoid: landscape YouTube preset)*
- **Repliz**: third-party account-verification provider (Access Key/Secret Key vault, `replizId` platform account id).