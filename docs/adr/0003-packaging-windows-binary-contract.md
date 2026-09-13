# ADR-0003 — Packaging Windows & Binary Contract

Status: Proposed
Date: 2026-09-12
Affects: Architect, Build, Distribution

## Context

Aplikasi hanya bisa dijalankan via `bun run dev`; tidak ada installer. Bug kritis pernah terjadi karena `src/main/index.ts` menunjuk preload `index.js` padahal output `preload.mjs`. Binary `ffmpeg`/`yt-dlp` hanya diharapkan ada di PATH, tanpa jaminan.

## Decision

- Adopsi **electron-builder** (NSIS installer, target win-x64) sebagai langkah packaging pertama.
- Buat `electron-builder.yml` yang:
  - menetapkan `output: release/` dan `appId`;
  - mengemas `out/{main,preload,renderer}`;
  - **memin versi `ffmpeg` (mis. 6.x win64)** dan `yt-dlp` ke folder binary yang di-resolve `main` sebelum `spawn`, dengan fallback PATH;
  - menegakkan `preload: out/preload/preload.mjs`.
- Tambah script `bun run pack` dan `bun run pack:dir`.

## Consequences

- Positif: installer menyebarkan binary yang konsisten; bug preload output ter-guard oleh build config; user bisa install tanpa toolchain.
- Negatif: menambah dependensi dev (electron-builder + binary bundled); ukuran installer lebih besar karena FFmpeg/yt-dlp.
- Keterbukaan: auto-update, signing, code-sign certificate ditunda.
