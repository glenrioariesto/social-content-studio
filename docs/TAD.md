# TAD — Social Content Studio (MVP)

> **Technical Architecture Document** — desktop Electron, local-first, Windows.
> Versi 1.0 — 2026-09-12.
> Panduan kontrak: `packages/shared/src/` adalah source of truth;
> konsumen (renderer, main IPC, preload, persisted JSON) wajib sinkron saat berubah.

---

## 1. Arsitektur Umum

```
┌─────────────────────────────────────────────────────────────┐
│  Electron (3-process)                                        │
│  ┌────────────┐   IPC   ┌──────────────┐   ┌──────────────┐  │
│  │  renderer  │◀───────▶│  preload     │──▶│  main        │  │
│  │  React 19  │         │  contextBridge│  │  IPC + svc   │  │
│  │  Router /  │         │  window.electon│ │  services    │  │
│  │  Zustand   │         └──────────────┘  └──────┬───────┘  │
│  └────────────┘                                   │fs/ffmpeg │
│                                                   ▼          │
│                                        ┌──────────────────┐  │
│                                        │  workspace/ (JSON│  │
│                                        │  + binary output)│  │
│                                        └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              ▲
   packages/shared (kontrak: types, errors, validators, agent)
              ▲
  Client eksternal opsional (Repliz API via main, tidak dari renderer)
```

Prinsip:

- **Arah dependensi ke dalam:** main/renderer → `packages/shared`. Shared bebas Node/Electron/React.
- **Renderer never touches Node/Electron:** semua lintas `window.electron`.
- **Semua akses path melewati confinement guard** (`assertInsideWorkspace`) + validasi `SAFE_ID`.
- **Persistensi file-backed JSON**, tanpa database.
- **Manual publishing** adalah batas MVP; integrasi Repliz hanya verifikasi akun (Standard+ Account API).

## 2. Stack & Version Pin

| Layer | Teknologi | Catatan |
|------|-----------|---------|
| Shell | Electron 35 | `electron-vite` 3, Vite 6, Bun runtime |
| UI | React 19 + React Router 7 + Zustand 5 | Tailwind 4 + Lucide |
| Editor | `@monaco-editor/react` | HTML template editing |
| FS watch | chokidar 4 | debounce di `watchers/` |
| Backup | adm-zip 0.6 | pure-Node, tanpa shell |

**Kontrak binary eksternal (MUST di-pin di packaging):**

- `ffmpeg` — dipanggil `render-engine.ts` melalui `spawn('ffmpeg', ...)`. Resolusi: `ffmpegPath` settings → PATH. Bundler di tahap packaging memasang binary versi pin (mis. ffmpeg 6.x win64). Tanpa ini render gagal `FFMPEG_NOT_FOUND`.
- `yt-dlp` — dipanggil `resource.ts` melalui `spawn('yt-dlp', ...)`. Resolusi PATH, bundle opsional.

> Belum ada packaging (`electron-builder.yml` / `forge.config`). Lihat ADR packaging. Hingga itu ada, distribusi hanya `bun run dev`.

## 3. Struktur Direktori & Ownership

| Path | Ownership | Larangan |
|------|-----------|----------|
| `packages/shared/src/` | Kontrak domain | Impor Node/Electron/React |
| `src/main/` | Main process | Satu-satunya layer boleh Node + spawn |
| `src/main/ipc/` | Channel registration via `safeIpcMain` | Return `{success:false}` manual (pakai `ok/fail`) |
| `src/main/services/` | Domain services | Panggil HTTP/fs; tak dipanggil renderer langsung |
| `src/preload/index.ts` | Bridge `window.electron` | Tidak boleh bisnis logic |
| `src/renderer/` | UI React | Impor polos `window.electron` via `electron.d.ts` |
| `tests/` | Mirrors src/ | Bun consumer |

**Preload output contract (kritis, pernah rusak):**

- Output build preload = `out/preload/preload.mjs` (bukan `index.js`).
- `src/main/index.ts` wajib menunjuk `../preload/preload.mjs`.
- Jika berubah, sinkronkan di sini + CI check.
## 4. Kontrak IPC & Error Central

- Semua channel via `safeIpcMain(channel, handler, errorCode)`.
- Semua respons pakai `IPCResult<T>`; sukses `ok(data)`, gagal `throw createAppError(...)` (dilog oleh safe-handler) atau `fail(...)`.
- Guard terpusat `src/main/ipc/ipc-handler.ts`: `assertSafeId`, `assertReplizId`, `parseOptionalToken`.
- Renderer memanggil via `src/renderer/src/lib/ipc-call.ts` (`callIpc`, `requireBridge`) → toast Bahasa Indonesia via `ERROR_USER_MESSAGES`, detail teknis tetap di log file.
- Pertahankan sinkronisasi channel di: `src/main/ipc/*`, `src/preload/index.ts`, `src/renderer/src/lib/electron.d.ts`.

## 5. Kontrak Data & Schema Version

Semua dokumen JSON di `workspace` wajib menambah `schemaVersion` (rencana):

- `content.json`, `account.json`, `template.json` → `schemaVersion: 1`.
- Migrasi pakai pola **expand → migrate → contract** (dari `dokumenpembelajaran`): operasi breaking tidak digabung dalam satu migrasi.
- Validator `validateAccount/Content/Template` tetap total; field baru opsional dianggap absent.

## 6. Workspace Root & Settings Lifecycle

- `workspace-root.ts` resolusi: `settings.json#workspacePath` eksis → pakai; tidak → default `cwd/workspace`; terkonfigurasi tapi hilang → THROW (tanpa silent fallback).
- `settings:write` memvalidasi folder eksis + restart untuk aktivasi.
- Untuk installed/portable Windows perlu strategi path dengan spasi/unicode (belum ada — lihat ADR packaging).

## 7. Render Pipeline & Queue Durability

- `render-queue.ts` kini **persisten**: metadata job ditulis ke `workspace/renders/queue.json` tiap mutasi (`persist()`), dan `init()` saat startup.
- Restore: `queued` di-reprocess; `rendering` dari sesi crash menjadi `failed` ("Interrupted by shutdown") — sealur dengan `startupSweep` content.
- State job: `queued|rendering|completed|failed` (terpisah dari lifecycle content `CONTENT_STATUS_FLOW`).
- `maxConcurrentRender` membatasi concurrency.

## 8. Repliz Boundary (Standard+)

Client Repliz **hanya di main** (`src/main/services/repliz.ts`):

- Base URL `https://api.repliz.com`, auth `Basic Base64(AccessKey:SecretKey)`.
- Kredensial di-vault `safeStorage` → `workspace/config/repliz-credentials.enc.json`; tak pernah ke renderer/log.
- Verifikasi: `GET /public/account/{accountId}` → simpan `replizId`, `replizPlatform`, `replizConnected`, `replizVerifiedAt` di `account.json`.
- Tier: Standard+ (Account/Comment) untuk MVP. Premium+/Gold+ untuk schedule/chat/content ditunda sampai user subscribe.
- Offline-first: tanpa internet, `replizConnected` tetap kosong, aplikasi tetap jalan.

## 9. Logging & Audit

- Main: `workspace/config/logs/YYYY-MM-DD.log` via `src/main/errors.ts`.
- Renderer: `error-logger.ts` + `logRendererError`; toast via `useErrorToast`.
- Ambisi berikutnya: `requestId` end-to-end renderer→main untuk korelasi.

## 10. Build, Packaging & Distribution

- Development: `bun run dev` (HMR via `ELECTRON_RENDERER_URL`).
- Build: `bun run build` → `out/{main,preload,renderer}`.
- Packaging Windows (installer NSIS): **belum ada** — lihat ADR packaging. `electron-builder.yml` wajib memin `ffmpeg`/`yt-dlp` dan menetapkan `preload.mjs`.

## 11. Testing, CI & Gate

- Runner: `bun test`; lint/format: belum (rencana ESLint flat + Prettier + husky ala `dokumenpembelajaran`).
- Gate wajib: `bun run typecheck` + `bun test` + `bun run build`.
- Ambisi: CI otomatis + perf budget renderer bundle + E2E.

## 12. Definition of Done

Perubahan dikatakan selesai bila `packages/shared` jenis, main IPC, preload bridge, deklarasi renderer, perilaku UI, perilaku file persisted, dan gate validasi konsisten.