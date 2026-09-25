---
goal: Strategic Integration of TypeSafe AI into Social Content Studio
version: 1.0
date_created: 2026-09-26
owner: Principal Architect
status: "Planned"
tags: ["ai", "typesafe", "strategy", "autonomous-loop"]
---

# TypeSafe AI Integration Strategy

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This document outlines the strategic roadmap for integrating `typesafe-ai` into the `social-content-studio` project. This strategy is designed to be executed incrementally by the Autonomous SDLC Loop (`run-autonomous-sdlc-loop.md`), transforming the application into a "smart" local-first content manager.

## 1. Core Philosophy: Semantic Tech Debt Resolution

The autonomous loop has been updated to hunt for **Semantic Tech Debt**. Instead of just fixing syntax or test coverage, the loop will identify areas where brittle heuristics (like complex RegEx or manual categorization) are used, and replace them with deterministic AI judgments (Noul, Choice, Score) powered by TypeSafe's System One models (Jev).

## 2. Priority AI Features (For Autonomous Execution)

The following features have been identified as high-value targets for the autonomous loop to implement in future iterations:

### Phase 1: Smart FFmpeg Error Analyzer (Priority: High)
- **Problem**: When a render fails, the user is presented with raw, difficult-to-understand FFmpeg `stderr` logs.
- **TypeSafe Primitive**: `Choice`
- **Implementation**: Intercept the FFmpeg crash log. Use TypeSafe to classify the raw log into a predefined set of user-friendly error categories (e.g., `["codec_unsupported", "corrupt_input", "out_of_memory", "resolution_mismatch", "unknown"]`).
- **Benefit**: Transforms cryptic technical failures into actionable UI feedback.

### Phase 2: Automated Asset Tagging & Categorization (Priority: Medium)
- **Problem**: The `workspace/assets/` directory relies on manual user organization and naming conventions.
- **TypeSafe Primitive**: `Choice` (and/or `Noul` for boolean tags)
- **Implementation**: Create a background worker that scans new text/image assets upon import. TypeSafe analyzes the content and assigns structured semantic tags (e.g., `primary-content`, `b-roll`, `overlay`, `audio-track`).
- **Benefit**: Enables intelligent search and filtering without manual data entry.

### Phase 3: Content Brand & Tone Guardrails (Priority: Medium)
- **Problem**: Captions or text injected into HTML templates may contain typos, profanity, or deviate from the user's professional brand tone.
- **TypeSafe Primitive**: `Noul` (Probability of Yes)
- **Implementation**: Before rendering, pass the compiled text payload to TypeSafe with the query: *"Does this text align with a professional brand tone and is it free of profanity/errors?"*.
- **Benefit**: Acts as an automated QA gate, disabling the 'Render' button and providing warnings if the score is too low.

### Phase 4: Template-to-Asset Matchmaker (Priority: Low / Future)
- **Problem**: Users must manually guess which local asset best fits a specific HTML template placeholder.
- **TypeSafe Primitive**: `Score`
- **Implementation**: When a template is selected, score all available assets (0-100) based on their semantic relevance to the template's metadata. 
- **Benefit**: The UI can auto-suggest the top 3 best-fitting assets for faster workflow.

## 3. SDLC Loop Integration Rules

When the autonomous loop (`/fable-protocol`) picks up one of these phases, it MUST follow the standard SDLC:
1. **Spec**: Define the exact TypeSafe prompt, state schema, and criteria in the `spec/` folder.
2. **Plan**: Break down the IPC and UI changes.
3. **Code**: Implement using the installed `typesafe-ai` SDK (`npx skills add typesafe-ai/skills`).
4. **Test**: Write mock tests ensuring the application behaves correctly based on deterministic AI outputs.
