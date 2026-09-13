# ADR-0001 — Studio Agent Tools via Intent-Only IPC

Status: Proposed
Date: 2026-09-12
Affects: Architecture, IPC boundary, packages/shared contract

## Context

Social Content Studio direncanakan menjadi studio + custom agent:
AI agent membutuhkan tools yang bisa dipanggil dalam lingkup proyek ini.
Batasan eksisting (ARCHITECTURE.md + AGENTS.md):

- Renderer tidak boleh menyentuh Node/Electron langsung;
  semua akses lewat `window.electron` + IPC.
- Setiap channel path-taking wajib lewat `assertInsideWorkspace`;
  id validasi `SAFE_ID`; status via `assertLegalTransition`.
- Kontrak shared (`packages/shared/src`) adalah source of truth.
- Governance yang diadaptasi dari dokumenpembelajaran (TAD 11.1, AGENTS.md 8):
  kontrak dulu, satu FR satu PR, ambigu = hentikan dan catat,
  tanpa dependensi di luar whitelist, tanpa `any` di jalur kritis.

## Decision

Pola **Opsi A (In-App Agent Tools)**: manifest tool intent-only di
`packages/shared/src/agent.ts` (8 tools: `content.list/get/create/transition`,
`template.list`, `render.enqueue/jobs`, `workspace.backupInfo`),
dieksekusi main di `src/main/ipc/agent.ts` via channel
`agent:list-tools` + `agent:invoke`, dijembatani preload
`window.electron.agent` dan deklarasi `electron.d.ts`.
Opsi B (MCP server eksternal) ditunda sebagai langkah lanjutan yang
membungkus tool yang sama.

## Consequences

- Positif: tidak ada akses FS arbitrer dari agent; semua aturan
  confinement/guard tetap di main; mudah diuji (`tests/services/agent.test.ts`).
- Negatif: agent internal Electron dulu; klien eksternal (Claude/Opencode)
  butuh wrapper MCP terpisah.
- Tindak lanjut: `docs/OPEN_QUESTIONS.md` (STUDIO-001..003) untuk MCP,
  izin tulis, dan kuota render.
