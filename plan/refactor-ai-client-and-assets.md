---
goal: "Perbaikan Arsitektur Klien AI, Manajemen Memori Aset, dan UX Pengaturan"
version: 1.0
date_created: 2026-09-26
status: "Planned"
tags: ["refactor", "clean-code", "architecture", "security"]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Rencana refactoring ini bertujuan untuk memperbaiki beberapa kelemahan arsitektural dan potensi masalah kinerja yang teridentifikasi selama proses integrasi multi-provider AI dan perbaikan tampilan aset. Kita akan fokus pada perbaikan *code smell* (pelanggaran prinsip Open/Closed), pencegahan *memory exhaustion* saat memuat aset besar, dan peningkatan umpan balik (feedback) pengguna.

## 1. Traceability: Requirements & Constraints

- **REQ-001**: [Functional] UI Settings harus memiliki fitur "Test Connection" untuk memvalidasi *API Key* AI yang dimasukkan pengguna sebelum disimpan.
- **PRN-001**: [Architecture] Terapkan pola *Strategy* atau *Polymorphic Dispatcher* pada `callAiProvider` untuk menghilangkan *if/else* berantai yang rentan melanggar prinsip *Open/Closed*.
- **SEC-001**: [Security/Performance] Batasi ukuran file (misalnya maksimal 5MB) saat melakukan konversi ke Base64 di `fs:read-image-base64` untuk mencegah *Memory Exhaustion (DoS)* pada IPC.
- **REQ-002**: [Functional] Fitur unduh video (menggunakan `yt-dlp`) harus bisa mendeteksi binari internal di mode pengembangan.

## 2. Implementation Steps

> **⚠️ EXECUTION DIRECTIVE FOR AI AGENTS (`/sdlc-write-code`):**
> You MUST execute this plan phase by phase. You MUST run the specific testing/verification task at the end of each phase. After a phase is tested, you **MUST STOP AND WAIT** for the user's explicit approval before proceeding to the next phase. **DO NOT SKIP PHASES.**

### Implementation Phase 1: Security Remediation & Path Resolution

- **GOAL-001:** Mencegah aplikasi *crash* akibat kehabisan memori pada IPC dan memperbaiki resolusi binari lokal untuk pengunduhan video (`yt-dlp`) saat masa *development*.

| Task ID  | Description (Include Exact File Paths & Micro-Testing)                         | Ref ID  | Completed | Date |
| -------- | ------------------------------------------------------------------------------ | ------- | :-------: | :--: |
| TASK-101 | Di `src/main/ipc/filesystem.ts`, tambahkan pemeriksaan ukuran file (maks 5MB) sebelum memanggil `readFile` pada `fs:read-image-base64`. Jika lebih besar, kembalikan *error* atau ikon *placeholder*. | SEC-001 |    [ ]    |      |
| TASK-102 | Di `src/main/services/binary-resolver.ts`, perbaiki `resolveBinary` agar mendeteksi binari di folder lokal `binaries/${platform}/` saat berada di mode *development* (!app.isPackaged). | REQ-002 |    [ ]    |      |
| TASK-10X | **VERIFY**: Coba tampilkan aset berukuran lebih dari 5MB dan lakukan tes unduh video internet. Pastikan `yt-dlp` ditemukan dan tidak *error*. | -       |    [ ]    |      |
| TASK-10Y | **APPROVAL**: 🛑 Wait for explicit user confirmation to proceed to Phase 2     | -       |    [ ]    |      |

### Implementation Phase 2: Core Architectural Refactoring (AI Client)

- **GOAL-002:** Memisahkan logika konfigurasi spesifik dari setiap *provider* (Antigravity, Claude, OpenAI) ke dalam struktur *Strategy Pattern* agar *codebase* lebih bersih dan mudah dikembangkan (SOLID).

| Task ID  | Description (Include Exact File Paths & Micro-Testing)                         | Ref ID  | Completed | Date |
| -------- | ------------------------------------------------------------------------------ | ------- | :-------: | :--: |
| TASK-201 | Di `src/main/services/typesafe-client.ts`, refactor `callAiProvider` dengan menggunakan objek *adapter* / *dispatcher* untuk masing-masing *provider* alih-alih `if/else` yang panjang. | PRN-001 |    [ ]    |      |
| TASK-202 | Ubah logika penanganan *error* pada *client* agar mengembalikan informasi *error* yang jelas (bukan hanya `return null`), sehingga UI tahu jika *API Key* salah. | PRN-002 |    [ ]    |      |
| TASK-20X | **VERIFY**: Jalankan aplikasi dan pastikan fungsi rekomendasi AI tetap berfungsi dengan baik menggunakan berbagai *provider*. | -       |    [ ]    |      |
| TASK-20Y | **APPROVAL**: 🛑 Wait for explicit user confirmation to proceed to Phase 3     | -       |    [ ]    |      |

### Implementation Phase 3: UX & Functional Improvements

- **GOAL-003:** Memberikan umpan balik langsung kepada pengguna mengenai keabsahan konfigurasi AI mereka.

| Task ID  | Description (Include Exact File Paths & Micro-Testing)                         | Ref ID  | Completed | Date |
| -------- | ------------------------------------------------------------------------------ | ------- | :-------: | :--: |
| TASK-301 | Di `src/renderer/src/pages/SettingsPage.tsx`, tambahkan tombol "Test Connection" di bawah input konfigurasi AI yang memanggil *endpoint* IPC baru untuk memvalidasi kredensial. | REQ-001 |    [ ]    |      |
| TASK-302 | Buat *handler* IPC `ai:test-connection` di *backend* (di file `typesafe-client.ts` atau `ipc/agent.ts`) yang mengirim *prompt* *ping* sederhana ke *provider* yang dipilih. | REQ-001 |    [ ]    |      |
| TASK-30X | **VERIFY**: Klik "Test Connection" dengan kunci yang salah (pastikan muncul peringatan merah) lalu dengan kunci yang benar (muncul centang hijau). | -       |    [ ]    |      |
| TASK-30Y | **APPROVAL**: 🛑 Wait for explicit user confirmation to proceed                | -       |    [ ]    |      |

## 3. Structural Remedies & Alternatives

- **ALT-001**: Awalnya dipertimbangkan untuk menggunakan Vercel AI SDK, namun ditolak karena akan menambah kompleksitas dependensi yang tidak perlu untuk MVP lokal. Pendekatan REST *client* dengan pola *Strategy* lebih ringan dan cukup.

## 4. Dependencies

- **DEP-001**: Tidak ada dependensi baru yang direncanakan.

## 5. Files Affected

- **FILE-001**: `src/main/ipc/filesystem.ts` (Pembatasan memori Base64)
- **FILE-002**: `src/main/services/binary-resolver.ts` (Perbaikan deteksi yt-dlp)
- **FILE-003**: `src/main/services/typesafe-client.ts` (Refactoring arsitektur AI, penambahan error log, handler test-connection)
- **FILE-004**: `src/renderer/src/pages/SettingsPage.tsx` (Penambahan tombol Test Connection)
- **FILE-005**: `src/preload/index.ts` (Penambahan fungsi jembatan `ai.testConnection`)

## 6. Testing Strategy

- **TEST-001**: Uji coba penanganan batas ukuran file (> 5MB).
- **TEST-002**: *Smoke test* integrasi ke 3 provider berbeda (OpenAI, Anthropic, Custom) menggunakan kredensial dummy dan nyata.
- **TEST-003**: *UI test* untuk tombol "Test Connection" dan respons peringatan interaktifnya.

## 7. Risks & Rollback Plan

- **RISK-001**: Jika struktur JSON dari *provider* kustom berubah, sistem ekstraksi *Regex* bisa gagal.
  - **Mitigation**: Mempertahankan balikan *null* yang ditangani dengan baik (Graceful Degradation) di level UI tanpa membuat *crash* aplikasinya.
