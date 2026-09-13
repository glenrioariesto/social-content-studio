export * from './domain'

// Re-export domain types and constants
export {
  CONTENT_STATUSES,
  isContentStatus,
  WORKFLOW_TYPES,
  isWorkflowType,
  TEMPLATE_TYPES,
  isTemplateType,
  RENDER_PRESETS,
  isRenderPreset,
  RENDER_JOB_STATUSES,
  isRenderJobStatus,
  FILE_CHANGE_TYPES,
  ALLOWED_LOGO_EXTENSIONS,
  MAX_LOGO_BYTES,
  SAFE_ID_PATTERN,
  REPLIZ_ID_PATTERN,
  isSafeId,
  isReplizId
} from './domain'

// Re-export domain types for use in this file
import type { ContentStatus, WorkflowType, TemplateType, RenderPreset, RenderJobStatus, FileChangeType, LogoExtension } from './domain'
export type { ContentStatus, WorkflowType, TemplateType, RenderPreset, RenderJobStatus, FileChangeType, LogoExtension }

export interface Account {
  id: string
  name: string
  description?: string
  /** Repliz account id (GET /public/account/{accountId}), e.g. Mongo ObjectId. */
  replizId?: string
  /** Repliz platform type, e.g. tiktok | instagram | youtube | facebook | threads | linkedin. */
  replizPlatform?: string
  /** Cached repliz connection status. `null` = unknown/offline. */
  replizConnected?: boolean
  /** Last successful verification timestamp (ISO). */
  replizVerifiedAt?: string
  workflows: WorkflowType[]
  templates: string[]
  branding: {
    logo?: string
    watermark?: string
  }
}

export interface ReplizCredentialsStatus {
  configured: boolean
  encrypted: boolean
  accessKeyMasked?: string
}

export interface ReplizAccountVerifyResult {
  replizId: string
  name: string
  username: string
  type: string
  isConnected: boolean
  verifiedAt: string
}

export interface Content {
  id: string
  title: string
  description?: string
  status: ContentStatus
  accountId: string
  templateId?: string
  resourcePath?: string
  compositionHtml?: string
  output?: {
    video: string
    thumbnail: string
  }
  caption?: string
  hashtags?: string[]
  scheduledAt?: string
  createdAt: string
  updatedAt: string
}

export type { TemplateDefinition as Template } from './template'

export type { Resource, DownloadJob, ResourceStatus } from './resource'

export type { RenderJobSummary } from './render'

export interface Recipe {
  id: string
  name: string
  input: {
    type: 'video' | 'image' | 'html'
    acceptMultiple?: boolean
  }
  process: RecipeStep[]
  output: {
    format: string
    codec: string
    fps: number
    width: number
    height: number
  }
}

export interface RecipeStep {
  action: 'scale' | 'overlay' | 'crop' | 'watermark' | 'normalize-audio' | 'concat' | 'add-audio'
  params: Record<string, string | number | boolean>
}

export interface RenderJob {
  id: string
  contentId: string
  status: 'waiting' | 'rendering' | 'completed' | 'failed'
  progress: number
  recipeId?: string
  preset?: RenderPreset
  outputPath?: string
  error?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export interface AppSettings {
  defaultPreset: RenderPreset
  maxConcurrentRender: number
  workspacePath: string
  ffmpegPath?: string
}

export interface FileChangeEvent {
  type: 'file.created' | 'file.modified' | 'file.deleted' | 'dir.created' | 'dir.deleted'
  path: string
  relativePath: string
  timestamp: number
}

export const CONTENT_STATUS_FLOW: Record<ContentStatus, ContentStatus[]> = {
  'idea': ['draft'],
  'draft': ['ready', 'idea'],
  'ready': ['rendering', 'draft'],
  'rendering': ['ready-to-post', 'failed'],
  'ready-to-post': ['posted', 'rendering'],
  'posted': ['ready-to-post'],
  'failed': ['rendering', 'draft']
}

export const DEFAULT_RENDER_PRESETS: Record<RenderPreset, { width: number; height: number; fps: number; codec: string; audio: string }> = {
  'instagram-reels': { width: 1080, height: 1920, fps: 30, codec: 'h264', audio: 'aac' },
  'tiktok': { width: 1080, height: 1920, fps: 30, codec: 'h264', audio: 'aac' },
  'youtube-shorts': { width: 1080, height: 1920, fps: 30, codec: 'h264', audio: 'aac' }
}
