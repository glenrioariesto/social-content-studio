import type { RenderJobStatus } from './domain'

/**
 * Render-job summary exposed through `render:jobs`. Mirrors the serialized
 * subset of a queue job (see `src/main/services/render-queue.ts`), typed once
 * here so main, preload bridge, `electron.d.ts`, and the renderer hook share
 * one contract without `unknown` casts.
 */
export interface RenderJobSummary {
  id: string
  contentId: string
  status: RenderJobStatus
  progress: number
  error?: string
  createdAt: string
  completedAt?: string
}