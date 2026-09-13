# Allowed tools — Social Content Studio (Agent)

Governance adaptasi dokumenpembelajaran `docs/allowed-deps.md`:
hanya tool di tabel ini yang boleh dipanggil AI agent studio.
Menambah tool = PR tersendiri + update manifest + alasan + test.

## Agent tools — installed (M1: intent-only IPC)

| Tool | Backing channel | Side effect | Why |
|------|-----------------|-------------|-----|
| `content.list` | `workspace:get-contents` | read | List LoadedEntry (valid/quarantine). |
| `content.get` | `workspace:get-content` | read | Get satu content by SAFE_ID. |
| `content.create` | `workspace:create-content` | write | Buat draft (status `idea`). |
| `content.transition` | `workspace:update-content` | write | Pindah status via CONTENT_STATUS_FLOW. |
| `template.list` | `workspace:get-templates` | read | List template LoadedEntry. |
| `render.enqueue` | `render:start` | write | Enqueue via queue (tanpa spawn FFmpeg langsung). |
| `render.jobs` | `render:jobs` | read | List job queue. |
| `workspace.backupInfo` | `backup:info` | read | Count workspace. |

## Dilarang (tanpa ADR + PR contract)

- `fs:*` generik langsung dari agent (bypass confinement intent).
- Spawn shell/FFmpeg/`yt-dlp` langsung dari agent/renderer.
- Status `scheduled`/preset landscape YouTube/`platform` baru
  tanpa migrasi shared + main + preload + renderer + JSON.
