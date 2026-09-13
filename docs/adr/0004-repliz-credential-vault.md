# ADR-0004 — Repliz Credential Vault (SafeStorage)

Status: Proposed
Date: 2026-09-12
Affects: Security, Repliz integration

## Context

Repliz (Standard+) memakai `Basic Base64(AccessKey:SecretKey)` di tiap request. Jika kredensial ditaruh di `account.json` atau diterima renderer, ia bocor ke log/file. Kredensial harus main-only.

## Decision

- Simpan kredensial di-vault **Electron `safeStorage`** → `workspace/config/repliz-credentials.enc.json`:
  - jika `safeStorage.isEncryptionAvailable()` → `encryptString` (OS keystore DPAPI/Keychain), `encrypted: true`;
  - jika tidak → base64 saja dengan `encrypted: false` (never claim secure).
- `Account.replizId` hanyalah referensi publik; akses key tidak pernah tersimpan di `account.json`.
- Renderer hanya melihat `ReplizCredentialsStatus` (`configured`, `encrypted`, `accessKeyMasked`) — bukan kredensial.
- Panggilan Repliz hanya dari `src/main/services/repliz.ts`, dengan timeout 15 s dan mapping error `REPLIZ_UNAUTHORIZED/ACCOUNT_NOT_FOUND/RATE_LIMITED/NETWORK_ERROR`.

## Consequences

- Positif: kredensial tidak bocor ke renderer/log; offline-first tetap berjalan tanpa internet.
- Negatif: `safeStorage` bergantung OS keystore; jika user pindah mesin, vault harus dikonfigurasi ulang.
- Tier lain (Schedule/Chat/Content) belum dipakai; ditunggu hingga user subscribe Premium+/Gold+.
