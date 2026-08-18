export type ResourceStatus = 'idle' | 'downloading' | 'ready' | 'failed'

export interface Resource {
  id: string
  source: 'upload' | 'internet'
  sourceUrl?: string
  fileName: string
  filePath: string
  thumbnail?: string
  duration?: number
  resolution?: string
  fileSize?: number
  tags?: string[]
  accountId?: string
  status: ResourceStatus
  createdAt: string
}

export interface DownloadJob {
  id: string
  url: string
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  progress: number
  outputPath?: string
  error?: string
  createdAt: string
}
