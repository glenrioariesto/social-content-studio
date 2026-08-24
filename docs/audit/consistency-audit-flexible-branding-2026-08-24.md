# Consistency Audit — Flexible Branding [Review Iteration 1]

- auditor: SDLC Audit Agent
- date: 2026-08-24
- upstream: docs/prd-20260824-1400-flexible-branding.md + spec/spec-flexible-branding-v1.0.md

## 1. Traceability matrix

| PRD item | Spec coverage | Verdict |
|---|---|---|
| FR-1 Account CRUD UI | §4 account:create/update + §5 AccountsPage editor | Covered |
| FR-2 logo file browser + drag&drop, copy into workspace, whitelist+size | §4 account:set-logo + §5 drop zone | Covered |
| FR-3 description persistence | §2 contract + validators §3 | Covered |
| FR-4 variable substitution in composition | §5 composition service | Covered — see FINDING-A for call-site ambiguity |
| FR-5 live account list in template form | §5 TemplatesPage | Covered |
| AC-8 async states | §5 editor states; traceability table | Covered |

## 2. Findings

- **FINDING-A (minor, spec gap):** §5 says substitution is wired "into the composition step where `compositionHtml` is produced (single call site; located during implementation)". Locating during implementation is under-specified — the Plan must pin the exact file/function, or the Code phase risks skipping the wiring entirely. → Action: Plan task must include a discovery sub-step with explicit output (file:line of the call site) recorded before coding.
- **FINDING-B (minor, contract risk):** Making `branding.logo` optional changes the existing shape. Existing `account.json` files on disk lack `description` and have logo as possibly-empty string; validator must accept both legacy shapes. Spec §3 covers missing fields but not the legacy empty-string case (`logo: ""`). → Action: validator test must include `logo: ""` accepted-as-absent.
- **FINDING-C (info):** `File.path` on dropped files is Electron-specific; if it is ever unavailable the UI shows an error (spec'd). No action.
- **FINDING-D (minor):** PRD success metrics ("under 30 seconds") is not testable in CI. Acceptable as product metric only; not carried into acceptance criteria. No action.

## 3. Readiness score

- Completeness: 37/40 — all FR/AC covered; call-site ambiguity (FINDING-A) is the sole gap.
- Clarity: 28/30 — concrete payloads, codes, patterns; one "located during implementation" clause.
- Alignment: 29/30 — vocabulary matches (Account/branding/logo/confinement); no orphaned items.

**Total: 94/100 — Good Enough (≥80). Proceed to Plan.**

## 4. Required actions before/during Plan

1. FINDING-A → Plan includes explicit call-site discovery task with recorded output.
2. FINDING-B → Plan's test task includes the legacy `logo: ""` case.
