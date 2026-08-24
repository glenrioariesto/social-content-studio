# Reference — IPC Confinement & Data Contracts

> Audience: developers working on the main-process IPC layer.
> Source of truth: `src/main/ipc/filesystem.ts`, `src/main/services/path-guard.ts`, `packages/shared/src/loaded-entry.ts`.

## Path-taking channels

Every IPC channel that resolves or writes a filesystem path MUST route the candidate through `assertInsideWorkspace(root, candidate, channel)` (`src/main/services/path-guard.ts`), where `root = getWorkspaceRoot()`.

| Channel | Confined? | Notes |
|---|---|---|
| `fs:read-file`, `fs:write-file`, `fs:readdir`, `fs:mkdir`, `fs:rm`, `fs:exists`, `fs:stat` | Yes | Generic handlers; candidate passed verbatim from renderer. |
| `workspace:get-content`, `workspace:update-content`, `workspace:delete-content` | Yes | Renderer-supplied `id` is first validated by `assertSafeId` (regex `^[A-Za-z0-9._-]+$`, rejects `..`), then the constructed path is confined. |
| `workspace:create-content` | Yes | `id` is server-generated (`generateUniqueContentId`). |
| `backup:export`, `backup:import` | Yes | Output/input zip path confined via `assertInsideWorkspace`. The prior `BACKUP_CHANNELS` whitelist is removed. |

## Confinement Guard rules (`assertInsideWorkspace`)

- Resolves candidate and root with `path.resolve`.
- Refuses a different drive letter (Windows).
- Refuses upward escape (`..`) and any path not starting with `root + sep`.
- Refuses the root itself (no operating on the boundary).
- Re-checks `realpath(candidate)` against `realpath(root)` to defeat symlink escapes (SEC-03).

On refusal it throws `AppError` with code `FS_PERMISSION_DENIED` and logs the attempt (SEC-003).

## `LoadedEntry<T>` (read contract)

Every list/get read returns a discriminated union:

```ts
type LoadedEntry<T> = { kind: 'valid'; id: string; data: T }
                  | { kind: 'invalid'; id: string; file: string; issues: ValidationIssue[] }
```

- `validateContent` / `validateTemplate` / `validateAccount` (`packages/shared/src/validators.ts`) are hand-written type guards (no zod).
- A parse or validation failure yields `kind: 'invalid'` (never throws) and is logged (SEC-003).

## Content ID (`generateUniqueContentId`)

- Format: `content-<YYYYMMDDTHHMMSS>-<5 hex chars>`.
- Uniqueness: existence-loop up to 5 attempts (re-rolls suffix on collision).
- Replaces the old count-based ID.

## Status transitions (`assertLegalTransition`)

All `workspace:update-content` status writes — and the startup sweep's `rendering → failed` — pass through `assertLegalTransition(from, to)` enforcing `CONTENT_STATUS_FLOW`. Illegal transitions throw.

## Atomic writes

`atomicWriteJson(file, data)` writes to a temp file in the same directory then `rename`s — crash-safe. Used for content, template, account, and `settings.json` documents.
