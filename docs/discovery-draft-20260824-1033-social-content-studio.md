---
title: Project Discovery & Architecture Summary
status: DRAFT (Phase 0)
date_analyzed: 2026-08-24
---

# Project Discovery Summary

## 1. Project Overview

Social Content Studio is a local-first Electron desktop application for producing short-form vertical video content across multiple social-media brands from a single Windows machine. Its core business value is consolidating a solo creator's production pipeline — accounts, HTML templates, media assets, content composition, and FFmpeg rendering — into one offline tool, while deliberately leaving distribution manual (`ready-to-post` outputs are published by hand).

Current maturity: functional MVP skeleton with real seed data (3 accounts, 6 templates under `workspace/`), but the content and asset workflows appear barely exercised (`workspace/contents/` and `workspace/assets/` do not exist on disk yet — they are created lazily by IPC handlers).

## 2. Technology Stack & Infrastructure

*(Cross-reference: `/docs/ARCHITECTURE.md` Section 2 holds the canonical stack map; this section focuses on the aspects most relevant to product planning.)*

- **Core Framework/Language:** TypeScript (ESM) on Electron 35; React 19 renderer
- **State Management:** single Zustand store (`src/renderer/src/stores/app-store.ts`) plus per-domain data hooks (`useAccounts`, `useContents`, `useTemplates`, `useRenderQueue`, …); server-state lives in hooks, not global state
- **Key Dependencies:** react-router-dom 7 (12 routes), @monaco-editor/react (HTML template editing), chokidar 4 (workspace watching), lucide-react + Tailwind CSS 4 (UI)
- **Infrastructure/DB:** none — file-backed JSON under `workspace/`; FFmpeg is an external user-supplied binary configured via settings; Bun is the script runner

## 3. Current Architecture Assessment

The codebase follows a disciplined three-process Electron architecture with a shared-contract package (`packages/shared`) consumed by both main and renderer. It is modular and easy to navigate; the risks below are concentrated in the persistence/security layer rather than the overall shape.

### Strengths

- **Consistent IPC error envelope:** every channel registers through `safeIpcMain` (`src/main/ipc/safe-handler.ts`) using shared error codes — uniform, auditable failure handling.
- **Centralized domain contracts:** types, `CONTENT_STATUS_FLOW`, and render presets live only in `packages/shared/src/index.ts`; both processes import them directly.
- **Clean process boundaries:** renderer never imports Node/Electron APIs; all I/O crosses the preload bridge.
- **Explicit lifecycle machine:** content statuses transition through a declared flow map instead of ad-hoc string assignment.

### Tech Debt & Risks

| # | Risk | Location | Consequence |
|---|---|---|---|
| 1 | Generic `fs:*` IPC handlers accept arbitrary renderer-supplied paths, including recursive force-delete | `src/main/ipc/filesystem.ts:19-72` | A compromised renderer dependency can destroy files anywhere on the machine; violates the project's own security mandate |
| 2 | Content IDs derived from directory count | `filesystem.ts:129-131` | Delete-then-create sequences reuse IDs and silently overwrite existing `content.json`; parallel creates race |
| 3 | Persisted JSON parsed without schema validation; silent default-object fallbacks on parse failure | `filesystem.ts:74-89, 147-154` | Contract drift and data corruption go unnoticed; spread-merge lets arbitrary fields into stored documents |
| 4 | `settings.workspacePath` is dead configuration — runtime hardcodes `process.cwd()/workspace` | `filesystem.ts:8-10` | Users editing the visible setting see no effect; blocks relocatable/portable installs |
| 5 | Zero test infrastructure | `package.json` | Only static typecheck exists; regression risk grows with every feature; conflicts with the project's Two-Layer Testing Mandate |
| 6 | Renderer sandbox disabled (`sandbox: false`) | `src/main/index.ts:29` | Weakens renderer containment even though context isolation is on |
| 7 | Documentation gaps: no README, no CI, no packaging pipeline | repository root / `.github` absent | Onboarding friction; no reproducible distribution artifact |

## ⚙️ Operational Workflow

Three primary workflows traced end-to-end:

1. **Content Creation Flow:**
   `ContentCreationWizard` → `useContents` hook → `window.electron.workspace.createContent()` → `safeIpcMain('workspace:create-content')` → writes `workspace/contents/content-XXX/content.json` with initial status `idea`.

2. **Render Pipeline Flow:**
   Content detail view → `render.start` IPC → render queue service (concurrency capped by `maxConcurrentRender` from settings) → render engine builds and spawns an FFmpeg command for the selected preset (`instagram-reels` / `tiktok` / `youtube-shorts`, all 1080x1920@30) → progress events stream back through preload `on()` → `useRenderQueue` updates the queue page → terminal states drive `CONTENT_STATUS_FLOW` transitions (`rendering → ready-to-post` or `rendering → failed` with retry support).

3. **Template Authoring & Preview Flow:**
   Templates page → Monaco-based `TemplateEditor` edits `index.html`/variables alongside a `LivePreview` component → saves persist to `workspace/templates/<id>/{template.json,index.html,style.css}` → chokidar watcher broadcasts `FileChangeEvent`s → `useWorkspaceSync` refreshes affected views.

Supporting workflow: CSV-driven batch content creation/enqueue (`batch:*` IPC) for bulk production against one account.

## 5. Handoff Notes for Product Manager (/sdlc-draft-prd)

Things the PM must know before writing a PRD:

- **Open strategic decision (deliberately unresolved):** the next development push can either (a) stabilize the foundation — remediate risks #1–#5 above, add a test harness, wire up `workspacePath` — or (b) build new capability (e.g., real HTML-to-video capture, richer batch production). This discovery pass did **not** pick a winner; the PRD phase must resolve it with the user.
- **Hard product constraints inherited from architecture:** publishing is manual by design (no platform API integrations); `Content` has no `platform` field; there is no `scheduled` status; render presets are exclusively vertical (1080x1920). Any PRD touching these requires coordinated migration of shared contracts, IPC, renderer, and persisted JSON.
- **HTML preview is not video capture:** the LivePreview proves layout only; there is no Playwright/Chromium dependency for frame capture. A PRD promising "template renders to video" needs a technical spike first.
- **Data model reality check:** accounts/templates exist as seeded data; contents/assets flows are unexercised. Acceptance criteria for content CRUD should be treated as greenfield validation targets, not regressions.
- **Quality gate limitation:** with no test framework installed, verifiable acceptance criteria today reduce to `bun run typecheck` + `bun run build`. If the PRD's definition of done requires behavioral tests, test-infrastructure setup must be an explicit early milestone.
- **Terminology:** no `CONTEXT.md` glossary exists yet. Core terms (Content, Template, Account, Render Job, Preset) are unambiguous in `packages/shared/src/index.ts` and were used consistently in this draft; the clarification checkpoint may seed the glossary from them.
