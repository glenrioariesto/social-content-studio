# Autonomous SDLC Continuous Improvement Loop

This document contains a master prompt designed to trigger a continuous, autonomous improvement cycle across the codebase. It leverages the `fable-protocol` and our strict SDLC framework to identify and resolve technical debt, missing test coverage, or necessary refactoring without requiring constant manual intervention.

## How to Use

1. Open a new chat session.
2. Copy the entire prompt block below.
3. Paste it into the chat and hit enter.

## Master Prompt

```text
[Bypass SDLC]
I want to trigger an autonomous, continuous improvement loop across the codebase. Execute this via the `fable-protocol` to run autonomously without asking for permission on reversible steps. 

Your objective is to continuously improve the project by identifying and resolving technical debt, missing test coverage, necessary refactoring, and **Semantic Tech Debt** (opportunities to replace brittle RegEx/manual heuristics with deterministic `typesafe-ai` judgments). 

Follow this autonomous workflow strictly:

1. **Queue Management (Discovery)**
   - Scan the codebase to identify exactly 3 items:
     - (1) One traditional tech debt or refactor.
     - (2) One missing test coverage area.
     - (3) One **TypeSafe AI integration** (e.g., using `Choice`, `Noul`, or `Score` primitives to make the app smarter, such as classifying FFmpeg errors, auto-tagging assets, or content validation).
   - You MUST use the `todo` tool to queue these exactly 3 items.

2. **SDLC Pipeline Processing**
   - Process each item in the queue one by one. For each item, you must autonomously map it through our required SDLC phases:
     - **Specification:** Create or update a technical specification in the `spec/` directory.
     - **Planning:** Break the spec down into actionable implementation tasks in the `plan/` directory.
     - **Coding:** Implement the plan. You MUST adhere to the **Surgical Edit Mandate** (prioritize targeted edits; do not replace entire files unless creating new ones).
     - **Verification:** You MUST adhere to the **Two-Layer Testing Mandate** (add micro-level tests for every change, and ensure the macro test suite passes before completing the coding phase).

3. **Iteration Check**
   - At the end of every loop iteration (after coding/verifying an item), you MUST run `bun run typecheck` and `bun test`.
   - The macro suite must pass with zero failures before marking the `todo` item as done and moving to the next item in the queue.

4. **Loop completion**
   - Once an item is fully verified, mark it done in the `todo` tool and proceed to the next item in the queue until the queue is empty.
```
