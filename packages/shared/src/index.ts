export type ContentStatus =
  | 'idea'
  | 'draft'
  | 'ready'
  | 'rendering'
  | 'ready-to-post'
  | 'posted'
  | 'failed'

export type WorkflowType = 'manual-video' | 'internet-video' | 'product-video'

export type TemplateType =
  | 'html-template'
  | 'video-overlay'
  | 'image-overlay'
  | 'ffmpeg-composition'

export type RenderPreset = 'instagram-reels' | 'tiktok' | 'youtube-shorts'

export interface Account {
  id: string
  name: string
  description?: string
  workflows: WorkflowType[]
  templates: string[]
  branding: {
    logo?: string
    watermark?: string
  }
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

export interface Template {
  id: string
  name: string
  type: TemplateType
  accountId?: string
  input: {
    type: 'video' | 'image' | 'html'
  }
  output: {
    width: number
    height: number
    fps: number
  }
  overlay?: {
    file: string
    position: string
  }
  audio?: {
    enabled: boolean
  }
  variables?: string[]
}

export interface Resource {
  id: string
  source: string
  sourceUrl?: string
  downloadedFile: string
  thumbnail?: string
  duration?: number
  resolution?: string
  tags?: string[]
  createdAt: string
}

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
