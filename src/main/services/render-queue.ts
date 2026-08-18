import { EventEmitter } from 'events'
import { renderVideo, generateThumbnail, type RenderOptions } from './render-engine'
import { logInfo, logError } from '../errors'
import { createAppError } from '../../../packages/shared/src/errors'
import { join } from 'path'

export interface RenderJob {
  id: string
  contentId: string
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  progress: number
  options: RenderOptions
  error?: string
  createdAt: string
  completedAt?: string
}

class RenderQueue extends EventEmitter {
  private jobs: Map<string, RenderJob> = new Map()
  private maxConcurrent = 1
  private running = 0
  private queue: string[] = []

  setMaxConcurrent(n: number) {
    this.maxConcurrent = n
  }

  addJob(job: Omit<RenderJob, 'status' | 'progress' | 'createdAt'>): RenderJob {
    const full: RenderJob = {
      ...job,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString()
    }
    this.jobs.set(full.id, full)
    this.queue.push(full.id)
    this.emit('job:added', full)
    this.processQueue()
    return full
  }

  private async processQueue() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const jobId = this.queue.shift()!
      const job = this.jobs.get(jobId)
      if (!job || job.status !== 'queued') continue

      job.status = 'rendering'
      this.running++
      this.emit('job:started', job)

      try {
        const result = await renderVideo({
          ...job.options,
          onProgress: (p) => {
            job.progress = p
            this.emit('job:progress', { id: job.id, progress: p })
          }
        })

        if (result.success) {
          job.status = 'completed'
          job.progress = 100
          job.completedAt = new Date().toISOString()
          this.emit('job:completed', job)
          logInfo(`Render completed: ${job.id}`)

          const thumbPath = join(job.options.outputPath, '..', 'thumbnail.jpg')
          await generateThumbnail(job.options.outputPath, thumbPath)
        } else {
          job.status = 'failed'
          job.error = result.error
          this.emit('job:failed', job)
          logError(createAppError('RENDER_FAILED', result.error || 'Unknown', 'main', job))
        }
      } catch (err) {
        job.status = 'failed'
        job.error = err instanceof Error ? err.message : String(err)
        this.emit('job:failed', job)
      }

      this.running--
      this.processQueue()
    }
  }

  getJob(id: string): RenderJob | undefined { return this.jobs.get(id) }
  getAllJobs(): RenderJob[] { return Array.from(this.jobs.values()) }
  getActiveJobs(): RenderJob[] { return this.getAllJobs().filter(j => j.status === 'rendering' || j.status === 'queued') }
  cancelJob(id: string): boolean {
    const job = this.jobs.get(id)
    if (!job) return false
    if (job.status === 'queued') {
      this.queue = this.queue.filter(j => j !== id)
      job.status = 'failed'
      job.error = 'Cancelled'
      return true
    }
    return false
  }
}

export const renderQueue = new RenderQueue()
