# Explanation — Why the Foundation Stabilization changed how we handle paths and bad data

## The problem we started with

The original IPC layer accepted arbitrary filesystem paths from the renderer. Three concrete risks drove the stabilization work:

1. **Unbounded filesystem access.** Generic `fs:*` handlers took absolute paths from the renderer and acted on them — including `fs:rm` with `recursive: true`. A malicious or buggy renderer call could delete anything the OS user could reach.
2. **Shell command injection in backup.** `backup:export/import` interpolated a renderer-supplied path into a `powershell -Command "..."` string via `execSync`. A crafted path containing a quote could execute arbitrary commands (RCE).
3. **Crash-then-corrupt reads.** Reading a `content.json` that was truncated or malformed threw inside the handler, surfacing a blank screen or a hard crash instead of a recoverable state.

## Why a Confinement Guard

The fix is a single chokepoint, `assertInsideWorkspace`, applied to **every** path-taking channel — not scattered `startsWith` checks. Centralizing it means a new handler cannot "forget" confinement. The guard is lexical-first (handles `..`, other drives, the root boundary) and then re-checks the `realpath` to defeat symlink escapes. Backup paths are confined too, and the backup operation switched from `execSync` to `adm-zip` so no shell is ever spawned.

The renderer-supplied `id` gets its own defense-in-depth: a strict `SAFE_ID` regex plus a post-construction confinement check, because `join(root, id, 'content.json')` is only safe if `id` cannot carry a separator or `..`.

## Why `LoadedEntry<T>` instead of throwing

Previously a bad `content.json` crashed the read. Now every document read returns `LoadedEntry<T>` — either `{ kind: 'valid', data }` or `{ kind: 'invalid', issues }`. This is honest: the app shows a read-only **quarantine card** listing what's wrong, rather than fabricating a default object or crashing. It also keeps the renderer's type system honest — you must handle the invalid branch.

## Why a durable, non-count-based ID

The old ID was derived from a content count, which collides across folders and leaks ordering. The new `content-<timestamp>-<hex>` is globally unique, sortable, and collision-resistant via a bounded existence-loop.

## Why a status transition guard

Status is a state machine. Routing every write through `assertLegalTransition` prevents illegal jumps (e.g. `idea → posted`) that would bypass the render pipeline. The startup sweep uses the same guard for its `rendering → failed` recovery, so the recovery path is also validated rather than special-cased.

## Trade-offs accepted

- Symlink re-check adds a `realpath` syscall per confined call — negligible for local JSON documents.
- `LoadedEntry` shifts error handling to the UI layer (quarantine cards) — more code, but no silent corruption.
- `adm-zip` adds one dependency — chosen over `child_process` because it removes the entire shell-injection attack surface.
