# PRD — Flexible Branding (Account Logo & Title/Desc)

- id: prd-20260824-1400-flexible-branding
- status: Draft
- author: Glen Rio (via SDLC session)
- upstream: docs/discovery-draft-20260824-branding.md

## 1. Overview

Brand identity in Social Content Studio must be flexibly editable by the user without touching code or JSON files by hand. Today an account's logo/title/description exist only partially in the data contract and there is no UI to manage them; rendered output cannot reference them.

This PRD defines requirements for:

- Per-account editable branding: **logo** (image file), **title** (= account name), **description**.
- Making those values available inside HTML templates via variables so rendered content carries brand identity.

Out of scope: watermark editing beyond storing its path (existing field), multi-logo variants, cloud asset storage, platform API integrations.

## 2. User stories

| # | As a… | I want to… | So that… |
|---|---|---|---|
| US-1 | creator | create a new account with name, description, and logo | new brands can be added without editing files |
| US-2 | creator | edit an existing account's name/description/logo at any time | rebranding does not require code changes |
| US-3 | creator | pick a logo via file browser OR drag-and-drop it onto the account editor | uploading feels natural either way |
| US-4 | creator | see each account's logo on its card | I can recognize brands visually |
| US-5 | creator | use `{{account.logo}}`, `{{account.name}}`, `{{account.description}}` inside a template's HTML | every rendered item carries consistent branding automatically |
| US-6 | creator | pick the account from a live list when creating a template | I don't depend on hardcoded options |

## 3. Functional requirements

### FR-1 Account CRUD UI

- AccountsPage provides **Create** and **Edit** flows with fields: name (required), description (optional), logo (optional image).
- Delete is NOT in scope for this cycle (destructive; separate task).

### FR-2 Logo input — two paths

- **File browser:** user clicks "Choose logo…" → native dialog → file selected.
- **Drag & drop:** user drags an image file from the OS onto a drop zone.
- In both cases the main process copies the file into `workspace/accounts/<id>/assets/logo.<ext>` and stores that relative path in `branding.logo`.
- Accepted: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`; max 5 MB. Others are rejected with a clear message.

### FR-3 Description persistence

- `Account.description` (optional string) is persisted in `account.json` and survives restarts.

### FR-4 Template variable substitution

- During composition/render preparation, the placeholders `{{account.logo}}`, `{{account.name}}`, `{{account.description}}` are replaced with the bound account's values (logo → absolute `file://` path usable in `<img src>`).
- Unknown/absent values substitute to empty string (never crash).

### FR-5 Live account list

- The template creation form reads accounts dynamically instead of the hardcoded three options.

## 4. Acceptance criteria

- AC-1: Given no accounts exist, clicking "+ New Account" opens the form; submitting name only creates the account and its card appears.
- AC-2: Given an account, clicking Edit lets me change name/description; after save+restart the values persist.
- AC-3: Choosing a logo through the file browser copies it into the workspace and the card shows the image immediately.
- AC-4: Dragging a PNG onto the drop zone behaves identically to AC-3.
- AC-5: Selecting a 10 MB `.exe` as logo is refused with a visible error; nothing is copied into the workspace.
- AC-6: A template containing `<img src="{{account.logo}}">` renders with the account's logo visible in preview/output; unbound variables render as empty.
- AC-7: The template create form lists exactly the accounts that exist in the workspace at that moment.
- AC-8: All async states (loading/empty/error) are present in the account editor; destructive actions are not part of this cycle.

## 5. Non-functional requirements

- All file operations stay inside the workspace root (existing Confinement Guard rules apply to any new IPC channel).
- No new dependencies for file dialogs (Electron `dialog` API) or drag-drop (`File.path`).
- Tests: validators extended for `description` + logo extension whitelist; service-level test for the asset-copy path confinement.

## 6. Success metrics

- User can fully rebrand an account (name/desc/logo) in under 30 seconds without opening a file manager or editor.
- Zero hand-edited JSON needed for branding changes.
