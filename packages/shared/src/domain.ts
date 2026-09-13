/**
 * Domain constants and derived types for Social Content Studio.
 * Centralizes all closed sets of values (like Piknix domain/account.ts).
 */

// Content lifecycle statuses
export const CONTENT_STATUSES = ['idea', 'draft', 'ready', 'rendering', 'ready-to-post', 'posted', 'failed'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export function isContentStatus(value: string): value is ContentStatus {
  return (CONTENT_STATUSES as readonly string[]).includes(value)
}

// Workflow types
export const WORKFLOW_TYPES = ['manual-video', 'internet-video', 'product-video'] as const
export type WorkflowType = (typeof WORKFLOW_TYPES)[number]

export function isWorkflowType(value: string): value is WorkflowType {
  return (WORKFLOW_TYPES as readonly string[]).includes(value)
}

// Template types
export const TEMPLATE_TYPES = ['html-template', 'video-overlay', 'image-overlay', 'ffmpeg-composition'] as const
export type TemplateType = (typeof TEMPLATE_TYPES)[number]

export function isTemplateType(value: string): value is TemplateType {
  return (TEMPLATE_TYPES as readonly string[]).includes(value)
}

// Render presets
export const RENDER_PRESETS = ['instagram-reels', 'tiktok', 'youtube-shorts'] as const
export type RenderPreset = (typeof RENDER_PRESETS)[number]

export function isRenderPreset(value: string): value is RenderPreset {
  return (RENDER_PRESETS as readonly string[]).includes(value)
}

// Render job statuses
export const RENDER_JOB_STATUSES = ['waiting', 'rendering', 'completed', 'failed'] as const
export type RenderJobStatus = (typeof RENDER_JOB_STATUSES)[number]

export function isRenderJobStatus(value: string): value is RenderJobStatus {
  return (RENDER_JOB_STATUSES as readonly string[]).includes(value)
}

// File change event types
export const FILE_CHANGE_TYPES = ['file.created', 'file.modified', 'file.deleted', 'dir.created', 'dir.deleted'] as const
export type FileChangeType = (typeof FILE_CHANGE_TYPES)[number]

// Logo constraints
export const ALLOWED_LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'] as const
export type LogoExtension = (typeof ALLOWED_LOGO_EXTENSIONS)[number]
export const MAX_LOGO_BYTES = 5 * 1024 * 1024 // 5 MB

// ID validation
export const SAFE_ID_PATTERN = /^[A-Za-z0-9._-]+$/
export const REPLIZ_ID_PATTERN = /^[a-f0-9]{24}$/i

export function isSafeId(value: string): boolean {
  return SAFE_ID_PATTERN.test(value) && !value.includes('..')
}

export function isReplizId(value: string): boolean {
  return REPLIZ_ID_PATTERN.test(value)
}