# Implementation Plan — Flexible Branding v1.0

- id: plan-flexible-branding-v1.0
- status: Planned
- upstream: spec/spec-flexible-branding-v1.0.md + audit 94/100
- date: 2026-08-24

> **EXECUTION DIRECTIVE (`/sdlc-write-code`):** execute phases in order; run each phase's VERIFY, commit per phase, then continue. Do not skip VERIFY gates.

## 0. Pre-execution finding (resolves Audit FINDING-A)

Investigation confirmed: **no variable-substitution mechanism exists anywhere today.** `compositionHtml` is stored but never generated; render IPC takes raw paths. Therefore the Spec §5 "wiring" is not a relocation — it is **new construction**: the substitution function lives in `packages/shared/src/template-vars.ts` (pure, electron-free) and is consumed by (a) the renderer when composing/saving `compositionHtml`, and (b) covered by unit tests directly.

## Phase 1 — Contract + validators + substitution core (electron-free)

| Task | Description | Verify |
|---|---|---|
| TASK-101 | Extend `Account` in `packages/shared/src/index.ts`: add `description?: string`; make `branding.logo?: string` optional. Update all compile sites. | typecheck |
| TASK-102 | `validators.ts` `validateAccount`: description optional-string; logo optional matching `/^assets\/[A-Za-z0-9._-]+\.(png\|jpe?g\|webp\|svg)$/`; legacy `logo: ""` accepted-as-absent (Audit FINDING-B). | new tests green |
| TASK-103 | NEW `packages/shared/src/template-vars.ts`: pure `applyTemplateVariables(html, ctx)` replacing `{{account.name}}`, `{{account.description}}`, `{{account.logo}}` (logo → file:// URL or ''); unknown placeholders untouched. | unit test matrix |
| TASK-104 | Tests: validator cases (new/legacy/bad-logo), substitution matrix (bound/unbound/partial/no-context). | bun test |

## Phase 2 — Main-process IPC

| Task | Description | Verify |
|---|---|---|
| TASK-201 | `src/main/ipc/accounts.ts` (NEW): register via `safeIpcMain` → `account:create` (slug id `<slug>-<4hex>`, mkdir, atomic write), `account:update` (permit-list merge `[name, description]`), `account:set-logo` (ext whitelist + ≤5MB stat BEFORE copy; destination confined via `assertInsideWorkspace`; copy to `accounts/<id>/assets/logo.<ext>`; update branding atomically), `account:get-logo-url` (resolve abs → file:// URL). Register in `src/main/index.ts`. | typecheck:node |
| TASK-202 | Preload `window.electron.account.*` + `electron.d.ts` in same change-set. | typecheck both |

## Phase 3 — Renderer UI

| Task | Description | Verify |
|---|---|---|
| TASK-301 | AccountsPage: "+ New Account" inline form + AccountCard Edit panel (name required, description textarea, logo drop zone + Choose button, Save). Async loading/error states per REQ-007. Drop zone uses `File.path`; shows explanatory error if absent. | build + manual |
| TASK-302 | TemplatesPage: replace hardcoded account options with live `useAccounts()` data; list available variables under editor. | build |
| TASK-303 | Wire `applyTemplateVariables` into the point where template HTML is composed for preview/save (TemplateEditor save path). Record exact file:line here during execution: ________ | build + manual AC-6 |

## Phase 4 — Verification & docs

| Task | Description | Verify |
|---|---|---|
| TASK-401 | Full gate: `bun run typecheck && bun run build && bun test`. | all green |
| TASK-402 | Manual acceptance pass AC-1…AC-7 (create/edit/persist/browse+drop logo/reject bad file/live list). | checklist |
| TASK-403 | `/sdlc-code-review` handoff (reviewer generates refactor plan if needed). | report |

## Risks
- Electron `File.path` deprecation in newer versions → mitigation: error state already spec'd.
- Slug collision on account:create → 4-hex suffix + existence loop (reuse id.ts pattern).
