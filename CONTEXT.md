# Social Content Studio

This file acts as the project's Ubiquitous Language (Glossary). It defines terminology to prevent ambiguity across the codebase and documentation.

## Content & Rendering

**Content Lifecycle Statuses**:
The strict state machine progression for a content idea: idea, draft, ready, rendering, ready-to-post, posted, failed.
_Avoid_: scheduled, published, rendered

**Render Job Statuses**:
The state of an FFmpeg video rendering job in the queue: waiting, rendering, completed, failed.
_Avoid_: queued

**Workflow Types**:
The category of video creation process applied to an account: manual-video, internet-video, product-video.
_Avoid_: platform

**Render Presets**:
The predefined vertical video output formats: instagram-reels, tiktok, youtube-shorts.
_Avoid_: landscape YouTube preset

## System Architecture

**LoadedEntry**:
A discriminated union representing a document read that is either valid or invalid, surfacing invalid entries as a quarantine card instead of crashing.
_Avoid_: raw entry

**Repliz**:
A third-party account-verification provider used for linking and managing platform credentials securely.
_Avoid_: auth provider