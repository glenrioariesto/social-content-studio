# Social Content Studio Agent Guide

## Project intent

Social Content Studio is a local Electron desktop app for managing social-media content, HTML templates, local assets, and FFmpeg renders. It is a local-first MVP: metadata is stored as JSON under `workspace/`, assets and outputs remain on disk, and publishing to social platforms is manual.

## Source of truth

Use the implementation in `packages/shared/src/` as the canonical domain contract. Treat `Social Content Studio.txt` as product background and UX intent, not as an exact API or schema specification. When the document and code disagree, preserve the existing public TypeScript contract unless the task explicitly requests a migration.

Important current contracts:

- Content statuses are `idea`, `draft`, `ready`, `rendering`, `ready-to-post`, `posted`, and `failed`.
- Allowed status transitions are defined by `CONTENT_STATUS_FLOW` in `packages/shared/src/index.ts`. Do not assign a status directly without checking that flow.
- Render jobs use `waiting`, `rendering`, `completed`, and `failed`; this is separate from the content lifecycle.
- Render presets currently are `instagram-reels`, `tiktok`, and `youtube-shorts`. Do not add a landscape YouTube preset or a `scheduled` status unless the shared contract, renderer, UI, and persisted data are migrated together.
- `Content` currently has `accountId` and optional `templateId`, but no `platform` field. Do not invent platform persistence in renderer components.
- `Template`, `Resource`, `Recipe`, and `AppSettings` are shared contracts. Update consumers and serialized JSON together when changing them.

## Storage and runtime rules

- The workspace is the file-backed data store. Do not introduce a database or cloud dependency for MVP work.
- Existing main-process handlers generally resolve paths from `process.cwd()/workspace`. Follow the established IPC boundary; renderer code must use `window.electron` and must not import Node or Electron APIs.
- Validate and constrain filesystem paths in the main process. Never expose arbitrary filesystem access through a new renderer API.
- Keep IPC channel names and response shapes synchronized across `src/main/ipc/`, `src/preload/index.ts`, and `src/renderer/src/lib/electron.d.ts`.
- Use the existing error model in `packages/shared/src/errors.ts` and `safe-handler.ts`; do not silently swallow filesystem, render, or parse failures.
- `workspace/config/settings.json` is persisted configuration. Respect `workspacePath` and `ffmpegPath` semantics before changing path resolution.

## Rendering rules

- Rendering is a queue concern. Enqueue jobs through the existing render IPC and queue service; do not spawn FFmpeg directly from React.
- Keep concurrency controlled by `maxConcurrentRender`.
- HTML preview and actual video rendering are different operations. Do not claim Playwright/Chromium rendering is available unless the dependency and main-process implementation exist.
- A successful render must update the relevant persisted content/output state and emit the existing renderer events where applicable.
- Render failures must remain inspectable through the queue and logs and must support retry through the existing lifecycle.

## UI and workflow rules

- Preserve the existing React, React Router, Zustand, Tailwind, and Lucide patterns.
- Pages currently include dashboard, content, templates, assets, accounts, settings, queue, calendar, resources, batch render, and logs. Keep navigation and routes synchronized when adding or removing a page.
- Every async load or mutation needs a visible loading, empty, and error state where the surrounding page supports them.
- Keep forms aligned with the shared types and validate required fields before invoking IPC.
- Manual publishing is the MVP boundary: expose copy/export/open-output-folder/mark-as-posted workflows, but do not add platform API integrations without an explicit request.

## Change workflow for agents

1. Identify the owning abstraction and inspect its nearest consumer and type contract.
2. State the smallest behavioral hypothesis before editing.
3. Make the smallest compatible change; avoid unrelated refactors.
4. Run the narrowest relevant check immediately after the first edit.
5. For TypeScript changes, run `bun run typecheck:node` and/or `bun run typecheck:web`; for a cross-boundary change run `bun run typecheck`.
6. Run `bun run build` when touching Electron entrypoints, preload, IPC, rendering, or bundling.
7. If a behavior is changed, add or update a focused test when a test harness exists. Do not report unverified behavior as complete.

## Known inconsistencies to resolve deliberately

These are backlog items, not permission to change them opportunistically:

- Product text says `RENDERED`, `SCHEDULED`, and `PUBLISHED`; code uses `ready-to-post` and `posted` and has no scheduled transition.
- Product text describes a `platform` content field; the current `Content` type does not have one.
- Product text lists a landscape YouTube preset; the current preset union does not.
- Product text recommends Playwright/Chromium for HTML-to-video capture; Playwright is not currently a dependency.
- Product examples use several storage layouts, while the checked-in implementation uses `workspace/accounts`, `workspace/templates`, `workspace/contents`, and related folders. Prefer the checked-in layout.
- The configured `workspacePath` and the main-process `process.cwd()/workspace` resolution should be reconciled only as a focused settings/path task.

## Definition of done

A change is complete only when the relevant shared types, main IPC handler, preload bridge, renderer declarations, UI behavior, persisted-file behavior, and validation command are consistent. Mention remaining limitations explicitly in the final report.
