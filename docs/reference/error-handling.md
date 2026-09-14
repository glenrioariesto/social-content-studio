# Reference — Central Error Handling

> Audience: developers on IPC/error paths. Sumber kebenaran:
> `packages/shared/src/errors.ts`, `src/main/ipc/safe-handler.ts`,
> `src/main/ipc/ipc-handler.ts`, `src/renderer/src/lib/ipc-call.ts`.

## Alur error end-to-end

```text
Renderer handler/hook
  → callIpc({ call, showError, showSuccess, errorPrefix })
      → window.electron.<domain>.<method>()          [preload]
          → ipcRenderer.invoke(channel, ...)
              → safeIpcMain(channel, handler, errorCode)
                  → handler throw createAppError(...)
                      → logError() (file) → toIPCError() {
                          success:false, errorCode
                        }
  → callIpc memetakan errorCode → ERROR_USER_MESSAGES[kode]
      (toast Indonesia)
      → logRendererError(createRendererError(code, technical))
```

## Aturan main

- Semua channel lewat `safeIpcMain`; jangan `return { success:false }`
  manual — `throw` agar log otomatis, atau pakai `fail(...)`.
- Sukses pakai `ok(data)` / `toIPCResult(data)`.
- Path/id: `assertSafeId`, `assertReplizId`, `parseOptionalToken`
  (terpusat, jangan regex inline).
- Kredensial Repliz tidak pernah di-log; argumen channel sensitif
  di-redact sebelum masuk log — lihat `src/main/services/log-redact.ts`.
- Enkripsi jujur: jika `safeStorage` tidak tersedia, `encrypted: false`
  dilaporkan apa adanya + `logWarning` (ADR-0004).
- Level log: `logInfo` (normal), `logWarning` (gangguan non-fatal,
  mis. thumbnail gagal), `logError` (kesalahan yang memengaruhi fitur).

## Aturan renderer

- Pakai `callIpc`; jangan `try/catch` ad-hoc tiap hook.
- Bridge wajib: `requireBridge(window.electron?.x, 'window.electron.x')`.
- Toast Indonesia dari `userMessageFor(code, technical)`; detail teknis
  hanya di log.

## ErrorCode & pesan

- Union `ErrorCode` dan `ERROR_USER_MESSAGES` berada di shared dan wajib
  lengkap (test `tests/shared/errors.test.ts` memastikan setiap code
  punya pesan).
