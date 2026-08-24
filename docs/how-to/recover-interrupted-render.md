# How-to — Back up the workspace and recover an interrupted render

## Back up the workspace

1. Open **Settings** in the app.
2. Click **Export backup**. The app archives the entire `workspace/` folder to a `.zip` at the chosen path (inside the workspace root). No shell command is involved — archiving is done in-process with `adm-zip`.
3. To restore, click **Import backup** and select the `.zip`. It extracts over the workspace (overwrite).

> The backup path is confined to the workspace root. Choosing a path outside it is refused with `FS_PERMISSION_DENIED`.

## Recover content left "rendering" after a crash

If the app force-closed while a render was in progress, that content is stuck in `rendering`. On the next launch the **Startup Sweep** automatically:
- finds every `contents/<id>/content.json` with `status === 'rendering'`,
- marks it `failed` with `updatedAt` refreshed, via the legal `rendering → failed` transition,
- logs each recovery.

No manual step is required. After launch, the failed item appears in the content list with its failure reason ("interrupted by shutdown") and can be retried through the normal `failed → rendering` flow.

## Change the workspace folder

1. In **Settings**, set **Workspace path** to an existing directory.
2. The app validates that the folder exists and is a directory before saving, then returns `requiresRestart: true`.
3. Restart the app. The new root takes effect via `getWorkspaceRoot()`. If the configured path is later missing/invalid, the app refuses to fall back silently and surfaces an error state.
