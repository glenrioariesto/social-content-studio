import { EventEmitter } from 'events'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { renderVideo, generateThumbnail, type RenderOptions } from './render-engine'
import { logInfo, logError, logWarning } from '@main/errors'
import { getWorkspaceRoot } from './workspace-root'
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
 * Injected content-state callbacks invoked when a render finishes. Wired in
 * the IPC layer (render.ts) so the queue stays transport-agnostic. Missing
 * content docs are handled by the hook (warn, not throw); the queue also
 * guards each call so a hook failure never blocks persistence (RISK-002).
 */
export interface RenderContentStateHooks {
  onJobCompleted?: (job: RenderJob, thumbnailPath: string) => Promise<void>
  onJobFailed?: (job: RenderJob) => Promise<void>
}

/**
 * Durable render queue. Persists job metadata to `workspace/renders/queue.json`
 * after every mutation so a crash/restart can resume `waiting` jobs and flag
 * half-finished `rendering` jobs as `failed` (matching the startup sweep).
 */
export class RenderQueue extends EventEmitter {
  private jobs: Map<string, RenderJob> = new Map()
  private maxConcurrent = 1
  private running = 0
  private processing = false
  private queue: string[] = []
  private persistFile = join(getWorkspaceRoot(), 'renders', 'queue.json')
  private restored = false
  private ready: Promise<void> | null = null
  private contentStateHooks: RenderContentStateHooks = {}

  async init(): Promise<void> {
    this.ready = this.restore()
    await this.ready
  }

  setPersistFile(file: string): void {
    this.persistFile = file
  }

  setContentStateHooks(hooks: RenderContentStateHooks): void {
    this.contentStateHooks = hooks
  }

  private async runContentStateHooks(
    name: 'onJobCompleted' | 'onJobFailed',
    job: RenderJob,
    thumbnailPath?: string
  ): Promise<void> {
    const hook = this.contentStateHooks[name]
    if (!hook) return
    try {
      if (name === 'onJobCompleted') {
        await (hook as (job: RenderJob, thumb: string) => Promise<void>)(job, thumbnailPath ?? '')
      } else {
        await (hook as (job: RenderJob) => Promise<void>)(job)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logWarning(createAppError('IPC_HANDLER_ERROR', `Content-state hook "${name}" failed for job ${job.id}: ${msg}`, 'main', { jobId: job.id }))
    }
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
        logInfo(`Render queue restored: ${this.jobs.size} jobs, ${this.queue.length} waiting`)
      }
      void this.processQueue()
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

  private async processQueue(): Promise<void> {
    if (this.processing) return
    if (this.running >= this.maxConcurrent) return
    this.processing = true
    try {
      while (this.running < this.maxConcurrent && this.queue.length > 0) {
        const jobId = this.queue.shift()!
        const job = this.jobs.get(jobId)
        if (!job || job.status !== 'waiting') continue

        job.status = 'rendering'
        this.running++
        this.emit('job:started', job)
        await this.persist()
        void this.runJob(job)
      }
    } finally {
      this.processing = false
    }
  }

  private async runJob(job: RenderJob): Promise<void> {
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
        try {
          const thumbOk = await generateThumbnail(job.options.outputPath, thumbPath)
          if (!thumbOk) {
            logWarning(createAppError('THUMBNAIL_FAILED', `Thumbnail extraction produced no output: ${thumbPath}`, 'main', { jobId: job.id }))
          }
        } catch (thumbErr) {
          const msg = thumbErr instanceof Error ? thumbErr.message : String(thumbErr)
          logWarning(createAppError('THUMBNAIL_FAILED', msg, 'main', { jobId: job.id }))
        }
        await this.runContentStateHooks('onJobCompleted', job, thumbPath)
      } else {
        job.status = 'failed'
        job.error = result.error
        this.emit('job:failed', job)
        logError(createAppError('RENDER_FAILED', result.error || 'Unknown', 'main', job))
        await this.runContentStateHooks('onJobFailed', job)
      }
    } catch (err) {
      job.status = 'failed'
      job.error = err instanceof Error ? err.message : String(err)
      this.emit('job:failed', job)
      logError(createAppError('RENDER_FAILED', job.error, 'main', job))
      await this.runContentStateHooks('onJobFailed', job)
    } finally {
      await this.persist()
      this.running--
      process.nextTick(() => void this.processQueue())
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
