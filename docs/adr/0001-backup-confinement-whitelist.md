# 0001 - Backup export/import as the sole workspace confinement whitelist exception

**Date:** 2026-08-24  
**Status:** Accepted

## Context

The Foundation Stabilization cycle introduces strict path confinement for all renderer-exposed filesystem IPC (PRD GH-002) to prevent compromised renderer code from touching files outside the workspace. Backup export/import inherently writes to (and imports from) a destination chosen freely by the user, which contradicts an absolute confinement rule.

## Decision

Backup export and import channels are the single explicit whitelist exception to workspace confinement: they may access paths anywhere on disk because every invocation originates from a deliberate user action through a save/open dialog. Every whitelist invocation is logged with channel and path. All other channels remain strictly confined to the workspace root.

## Consequences

A security audit will find deliberate out-of-workspace write capability behind two channels and may flag it; the log trail exists to justify it. Users keep the natural mental model of saving backups wherever they want (other drives/partitions). Future file-touching features do NOT inherit this exception and must stay confined or earn their own explicit decision.

## Considered Options

- Strict confinement forcing backups into a folder inside the workspace was rejected because it breaks the expectation of storing backups on separate drives and complicates restoring from arbitrary locations.
