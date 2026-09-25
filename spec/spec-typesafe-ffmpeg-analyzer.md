---
title: Smart FFmpeg Error Analyzer (TypeSafe AI)
status: Approved
---

# Technical Specification: Smart FFmpeg Error Analyzer

## 1. Context & Objective
Currently, when FFmpeg fails during a render, the application logs the raw `stderr` and surfaces a generic `FFmpeg error (code X)` to the user. This specification integrates `typesafe-ai` to classify the raw `stderr` into user-friendly actionable feedback.

## 2. Architectural Constraints (Local-First)
Per `ARCHITECTURE.md`, the app is strictly local-first. Therefore:
- The TypeSafe AI integration MUST be **opt-in**.
- It requires a `typesafeApiKey` stored securely in the local `workspace/config/settings.json`.
- If the key is missing, or the network is offline, the system MUST gracefully degrade to the existing generic error behavior.

## 3. Implementation Details

### 3.1. TypeSafe Choice Primitive
We will use the TypeSafe `Choice` HTTP API to classify the error:
- **Endpoint**: `POST https://api.typesafe.ai/v1/choice`
- **Options**: `codec_unsupported`, `file_corrupted`, `out_of_memory`, `unknown`
- **State**: The last 500 characters of FFmpeg `stderr`.

### 3.2. Error Mapping
The resulting Choice will map to user-friendly messages:
- `codec_unsupported`: "Format video sumber tidak didukung oleh preset render ini."
- `file_corrupted`: "File video sumber rusak atau tidak dapat dibaca."
- `out_of_memory`: "Kehabisan memori saat melakukan render video."
- `unknown`: "Gagal memproses video (FFmpeg Error Code: {code})."

### 3.3. Modified `renderVideo` Flow
1. FFmpeg exits with `code !== 0`.
2. Retrieve `typesafeApiKey` from `settings.json`.
3. If key exists, attempt fetch to `api.typesafe.ai`.
4. Parse choice and replace the generic `error` string in the return payload.
5. If fetch fails, fallback to `unknown` pattern.
