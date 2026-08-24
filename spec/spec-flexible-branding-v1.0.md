# Technical Specification — Flexible Branding

- id: spec-flexible-branding-v1.0
- status: Draft
- upstream: docs/prd-20260824-1400-flexible-branding.md
- date: 2026-08-24

## 1. Scope

Implements FR-1…FR-5 of the Flexible Branding PRD. All file operations confined to the Workspace Root per the Foundation Stabilization Confinement Guard rules.

## 2. Data contract changes (`packages/shared/src/index.ts`)

```ts
export interface Account {
  id: string
  name: string
  description?: string          // NEW (FR-3), optional for backward compat
  workflows: WorkflowType[]
  templates: string[]
  branding: {
    logo?: string               // CHANGED: optional; relative path inside account dir
    watermark?: string
  }
}
```

- `branding.logo`: relative POSIX-style path from the account directory, e.g. `assets/logo.png`. Stored relatively so the workspace stays movable.
- No other contract changes. `Template` unchanged (variables already exist).

## 3. Validators (`packages/shared/src/validators.ts`)

- `validateAccount`: accept missing `description` and missing `branding.logo`; when present, `description` must be a string and `logo` must match `/^assets\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|svg)$/`.
- Unknown extra fields are ignored by merge on write.

## 4. IPC additions (`src/main/ipc/filesystem.ts`, preload, electron.d.ts)

| Channel | Payload | Behavior |
|---|---|---|
| `account:create` | `{ name, description? }` | Generates id via `generateUniqueContentId`-style slug (`<slug>-<4hex>`); mkdir `accounts/<id>/`; writes `account.json` atomically with empty workflows/templates and `branding: {}`. Returns full Account. |
| `account:update` | `{ id, data }` | Loads existing, merges via permit-list `[name, description]` through `mergeKnownFields`, atomic write. |
| `account:set-logo` | `{ id, sourcePath }` | Validates extension whitelist (.png/.jpg/.jpeg/.webp/.svg) + size ≤ 5 MB via stat; confines `sourcePath` is NOT required to be in workspace (user picks anywhere) but destination IS: copies to `accounts/<id>/assets/logo.<ext>` (overwrite ok), sets `branding.logo = 'assets/logo.<ext>'`, atomic write. Refusal codes: `FS_VALIDATION_ERROR` (bad type/size), `FS_PERMISSION_DENIED`. |

- All three register via `safeIpcMain`. Destination paths pass `assertInsideWorkspace`.
- Preload exposes `window.electron.account.{create, update, setLogo}`; `electron.d.ts` updated in same commit.
- Logo read path: renderer displays via existing `fs:` channel? No — images load directly with `file://` URL built from absolute path returned by a new helper `resolveAccountAsset(accountId, relPath)` exposed as `account:get-logo-url` returning `{ success, data: 'file:///...abs/path' }`.

## 5. Renderer changes

### AccountsPage (`src/renderer/src/pages/AccountsPage.tsx`)

- Adds "+ New Account" button → inline form (name, description).
- AccountCard gains an "Edit" affordance → editor panel with:
  - name input (required),
  - description textarea,
  - logo drop zone (drag & drop) + "Choose logo…" button,
  - Save button calling `account:update` / `account:set-logo` sequentially.
- Drop zone accepts `event.dataTransfer.files[0].path` (Electron augments File with `path`).

### TemplatesPage (`src/renderer/src/pages/TemplatesPage.tsx`)

- Replace hardcoded `<option>` list with `useAccounts()` data (AC-7).
- Info line under editor listing available variables: `{{account.name}}`, `{{account.description}}`, `{{account.logo}}`.

### Variable substitution (`src/main/services/composition.ts` — NEW)

- Pure function `applyTemplateVariables(html: string, ctx: { account?: Account }): string`
  - replaces `{{account.name}}`, `{{account.description}}`, `{{account.logo}}`;
  - logo value = resolved `file://` URL of the copied asset, or `''` if absent;
  - unknown placeholders remain untouched (no crash).
- Wired into the composition step where `compositionHtml` is produced (single call site; located during implementation).

## 6. Security & confinement notes

- `sourcePath` from renderer is only ever READ from (stat + copyFrom); never written to. Copy destination always passes `assertInsideWorkspace(root, dest, channel)`.
- Extension + size checks happen BEFORE any copy. Temp files are written inside the target assets dir then renamed.
- Drag-drop relies on Electron's `File.path`; if absent (non-Electron env), the drop zone shows an explanatory error instead of failing silently.

## 7. Testing strategy

- validators: description optional/logo pattern acceptance + rejection cases.
- service: slug generation uniqueness; variable substitution matrix (bound/unbound/partial).
- IPC-level confinement: `account:set-logo` refuses destination escape (unit-testable via guard reuse; full handler test deferred until harness supports main-process mocking).

## 8. Acceptance criteria traceability

| PRD | Covered by |
|---|---|
| FR-1 / AC-1 / AC-2 | §4 channels + §5 AccountsPage editor |
| FR-2 / AC-3 / AC-4 / AC-5 | §4 `account:set-logo` + §5 drop zone/button |
| FR-3 / AC-2 | §2 contract + §4 `account:update` |
| FR-4 / AC-6 | §5 substitution service |
| FR-5 / AC-7 | §5 TemplatesPage live list |
| AC-8 | §5 editor states (loading/error) per REQ-007 patterns |
