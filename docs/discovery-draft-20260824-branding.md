# Discovery Draft — Flexible Branding (Account Logo & Title/Desc)

- date: 2026-08-24
- phase: 0 (Discovery)
- status: Drafted
- source: user brief ("flexible editable, especially logo and title desc") + clarification

## 1. Problem

Brand identity is currently hard-wired at the data layer only:

- `Account.branding` has `logo` / `watermark` string fields but there is no UI to create or edit an account at all (AccountsPage is read-only cards + filter).
- `Account` has no `description` field.
- Templates have no branding story; render composition cannot pull account logo/title/description.
- There are three accounts in practice (Glen Rio Aristo, JacksonLab, HighProduct) whose names are hardcoded in the template creation form's `<select>`.

The user wants brand identity (logo, title, description) to be flexibly editable per account, and usable in rendered output.

## 2. Current architecture touchpoints (verified)

| Layer | File | State |
|---|---|---|
| Contract | `packages/shared/src/index.ts:20-29` | `Account { id, name, workflows, templates, branding: { logo, watermark } }` |
| Contract | `packages/shared/src/index.ts:51-72` | `Template { ... variables?: string[] }` |
| IPC | `src/main/ipc/filesystem.ts` | Only reads accounts (`workspace:get-accounts`). No create/update/delete-account channels. |
| Renderer | `src/renderer/src/pages/AccountsPage.tsx` | Read-only grid of AccountCard. No editor. |
| Renderer | `src/renderer/src/pages/TemplatesPage.tsx` | Create form with hardcoded account options; delete; Monaco editor for HTML. |
| Validators | `packages/shared/src/validators.ts` | `validateAccount` type-guard must be extended with any new field. |

## 3. User decisions (locked)

1. Logo input mechanism: **file browser dialog AND drag-and-drop**, per account. The chosen file is copied into the workspace (confinement-safe), never referenced from outside.
2. Template branding approach: **template variables** (`logo`, `title`, `description`) substituted during composition — consistent with the existing template variable system.

## 4. Candidate solution shape (for Spec phase)

- Extend `Account` contract: add optional `description`; keep `branding.logo`.
- New IPC channels: `workspace:create-account`, `workspace:update-account` (mergeKnownFields permit-list), plus an asset-copy channel for logos that confines destination inside `accounts/<id>/assets/`.
- Accounts page: create/edit form (name, description, logo picker + drag-drop zone, watermark).
- Templates: replace hardcoded account `<select>` with live accounts list; surface account variables (`{{account.logo}}`, `{{account.name}}`, `{{account.description}}`) available in HTML templates.
- Startup consideration: existing validators reject unknown/missing fields — extend `validateAccount` accordingly.

## 5. Risks / open items for Spec

- Drag-and-drop needs `File.path` from the drop event (Electron exposes it) → main process copies the file; renderer never touches fs directly.
- Logo file validation (extension/size whitelist) to avoid arbitrary file copies into workspace.
- Old accounts on disk may lack `description` — validator must treat it as optional.
