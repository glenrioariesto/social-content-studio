import { EventEmitter } from 'events'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { renderVideo, generateThumbnail, type RenderOptions } from './render-engine'
import { logInfo, logError } from '@main/errors'
import { createAppError } from '@shared/errors'
import type { RenderJobStatus } from '@shared/domain'

/** Serializable subset of a render job that survives restarts. */
export interface RenderJobMeta {
  id: string
  contentId: string
  status: RenderJobStatus
  progress: number
  options: Omit<RenderOptions, 'onProgress'>
  error?: string
  createdAt: string
  completedAt?: string
}

export type RenderJob = RenderJobMeta

/**
 * Durable render queue. Persists job metadata to `workspace/renders/queue.json`
 * after every mutation so a crash/restart can resume `queued` jobs and flag
 * half-finished `rendering` jobs as `failed` (matching the startup sweep).
 */
class RenderQueue extends EventEmitter {
  private jobs: Map<string, RenderJob> = new Map()
  private maxConcurrent = 1
  private running = 0
  private queue: string[] = []
  private persistFile = join(process.cwd(), 'workspace', 'renders', 'queue.json')
  private restored = false
  private ready: Promise<void> | null = null

  async init(): Promise<void> {
    this.ready = this.restore()
    await this.ready
  }

  setPersistFile(file: string): void {
    this.persistFile = file
  }

  private async persist(): Promise<void> {
    try {
      await mkdir(dirname(this.persistFile), { recursive: true })
      const data: RenderJobMeta[] = this.getAllJobs()
      await writeFile(this.persistFile, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      logError(createAppError('FS_WRITE_ERROR', `Failed to persist render queue: ${(err as Error).message}`, 'main'))
    }
  }

  /** Loads persisted jobs. `rendering` jobs from a crashed session become `failed`. */
  private async restore(): Promise<void> {
    try {
      const raw = await readFile(this.persistFile, 'utf-8')
      const parsed = JSON.parse(raw) as RenderJobMeta[]
      for (const job of parsed) {
        if (!job || typeof job.id !== 'string') continue
        // Legacy status persisted before the contract aligned on `waiting`.
        if ((job.status as string) === 'queued') {
          job.status = 'waiting'
        }
        if (job.status === 'rendering') {
          job.status = 'failed'
          job.error = job.error ?? 'Interrupted by shutdown'
        }
        this.jobs.set(job.id, job)
        if (job.status === 'waiting') {
          this.queue.push(job.id)
        }
        if (job.status === 'completed' && job.completedAt) {
          // keep completed jobs in history
        }
      }
      if (this.queue.length > 0) {
        logInfo(`Render queue restored: ${this.jobs.size} jobs, ${this.queue.length} queued`)
      }
    } catch {
      // no queue file yet — a fresh session
    }
  }

  async ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.restore()
    await this.ready
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = n
  }

  async addJob(job: Omit<RenderJobMeta, 'status' | 'progress' | 'createdAt'>): Promise<RenderJob> {
    await this.ensureReady()
    const full: RenderJobMeta = {
      ...job,
      status: 'waiting' as const,
      progress: 0,
      createdAt: new Date().toISOString()
    }
    this.jobs.set(full.id, full)
    this.queue.push(full.id)
    this.emit('job:added', full)
    await this.persist()
    void this.processQueue()
    return full
  }

  private async processQueue() {
    if (this.running >= this.maxConcurrent) return
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const jobId = this.queue.shift()!
      const job = this.jobs.get(jobId)
      if (!job || job.status !== 'waiting') continue

      job.status = 'rendering'
      this.running++
      this.emit('job:started', job)
      await this.persist()

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
      } finally {
        await this.persist()
        this.running--
        process.nextTick(() => void this.processQueue())
      }
    }
  }

  getJob(id: string): RenderJob | undefined { return this.jobs.get(id) }
  getAllJobs(): RenderJob[] {
    return Array.from(this.jobs.values())
  }
  getActiveJobs(): RenderJob[] { return this.getAllJobs().filter(j => j.status === 'rendering' || j.status === 'waiting') }

  async cancelJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id)
    if (!job) return false
    if (job.status === 'waiting') {
      this.queue = this.queue.filter(j => j !== id)
      job.status = 'failed'
      job.error = 'Cancelled'
      await this.persist()
      return true
    }
    return false
  }

  async removeJob(id: string): Promise<boolean> {
    const ok = this.jobs.delete(id)
    if (ok) await this.persist()
    return ok
  }

  /**
   * Graceful shutdown: mark running jobs as failed so they can be retried
   * on next startup (matches the startup sweep behavior).
   */
  async shutdown(): Promise<void> {
    for (const job of this.jobs.values()) {
      if (job.status === 'rendering') {
        job.status = 'failed'
        job.error = job.error ?? 'Interrupted by shutdown'
        this.running = Math.max(0, this.running - 1)
      }
    }
    this.queue = this.queue.filter(id => {
      const job = this.jobs.get(id)
      return job && job.status === 'waiting'
    })
    await this.persist()
    logInfo(`Render queue shutdown: ${this.jobs.size} jobs saved`)
  }
}

export const renderQueue = new RenderQueue()
