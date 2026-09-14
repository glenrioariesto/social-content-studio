import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { safeIpcMain } from './safe-handler'
import { renderQueue, type RenderJob } from '@main/services/render-queue'
import { generateThumbnail } from '@main/services/render-engine'
import { logInfo, logWarning } from '@main/errors'
import { assertInsideWorkspace } from '@main/services/path-guard'
import { getWorkspaceRoot } from '@main/services/workspace-root'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { RenderJobSummary } from '@shared/render'
import type { Content } from '@shared/index'
import { createAppError } from '@shared/errors'
import { assertLegalTransition } from '@main/services/lifecycle'
import { atomicWriteJson } from '@main/services/persistence'

export function initRenderIpc(mainWindow: BrowserWindow): void {
  function sendToRenderer(channel: string, data: unknown) {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data)
    }
  }

  renderQueue.on('job:progress', (data) => sendToRenderer('render:progress', data))
  renderQueue.on('job:completed', (job) => sendToRenderer('render:completed', { id: job.id, contentId: job.contentId }))
  renderQueue.on('job:failed', (job) => sendToRenderer('render:failed', { id: job.id, error: job.error }))
  renderQueue.on('job:started', (job) => sendToRenderer('render:started', { id: job.id }))

  /** Confines a renderer-supplied path to the workspace root (PRN-001). */
  function confineRenderPath(channel: string, candidate: string | undefined): string | undefined {
    if (!candidate) return undefined
    const confined = assertInsideWorkspace(getWorkspaceRoot(), candidate, channel)
    return confined.absolute
  }

  /** Content-state hooks: persist output on success, mark failed on failure. */
  renderQueue.setContentStateHooks({
    onJobCompleted: async (job, thumbnailPath) => {
      const root = getWorkspaceRoot()
      const jsonPath = join(root, 'contents', job.contentId, 'content.json')
      try {
        const raw = await readFile(jsonPath, 'utf-8')
        const content = JSON.parse(raw) as Content
        if (content.status === 'rendering') {
          assertLegalTransition(content.status, 'ready-to-post')
          content.status = 'ready-to-post'
          content.output = { video: job.options.outputPath, thumbnail: thumbnailPath }
          content.updatedAt = new Date().toISOString()
          await atomicWriteJson(jsonPath, content)
          logInfo(`Content ${job.contentId} → ready-to-post after render ${job.id}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logWarning(createAppError('CONTENT_NOT_FOUND', `Render completed but content update failed (${job.contentId}): ${msg}`, 'main', { jobId: job.id }))
      }
    },
    onJobFailed: async (job) => {
      const root = getWorkspaceRoot()
      const jsonPath = join(root, 'contents', job.contentId, 'content.json')
      try {
        const raw = await readFile(jsonPath, 'utf-8')
        const content = JSON.parse(raw) as Content
        if (content.status === 'rendering') {
          assertLegalTransition(content.status, 'failed')
          content.status = 'failed'
          content.updatedAt = new Date().toISOString()
          await atomicWriteJson(jsonPath, content)
          logInfo(`Content ${job.contentId} → failed after render ${job.id}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logWarning(createAppError('CONTENT_NOT_FOUND', `Render failed but content update failed (${job.contentId}): ${msg}`, 'main', { jobId: job.id }))
      }
    }
  })

  safeIpcMain('render:start', async (_event, jobData: {
    contentId: string
    inputPath: string
    outputPath: string
    width?: number
    height?: number
    fps?: number
    overlayPath?: string
    overlayPosition?: string
    preset?: string
  }) => {
    // PRN-001: renderer-supplied paths must never reach spawn(ffmpeg) unconfined.
    const inputPath = confineRenderPath('render:start', jobData.inputPath)
    if (!inputPath) {
      throw new Error('render:start requires an inputPath inside the workspace')
    }
    const overlayPath = confineRenderPath('render:start', jobData.overlayPath)
    const outputPath = confineRenderPath('render:start', jobData.outputPath) ?? join(getWorkspaceRoot(), 'renders')

    // SPEC-01: reject duplicate enqueue while a job is already active for this content.
    const existingJob = renderQueue.getActiveJobs().find((j) => j.contentId === jobData.contentId)
    if (existingJob) {
      throw createAppError('RENDER_FAILED', `A render job is already active for content ${jobData.contentId} (job ${existingJob.id})`, 'ipc', { contentId: jobData.contentId })
    }

    const job = await renderQueue.addJob({
      id: randomUUID(),
      contentId: jobData.contentId,
      options: {
        inputPath,
        outputPath,
        width: jobData.width || 1080,
        height: jobData.height || 1920,
        fps: jobData.fps || 30,
        overlayPath,
        overlayPosition: jobData.overlayPosition,
        preset: jobData.preset
      }
    })
    logInfo(`Render added: ${job.id} for content ${jobData.contentId}`)
    return { success: true, data: { jobId: job.id } }
  }, 'RENDER_FAILED')

  safeIpcMain('render:cancel', async (_event, jobId: string) => {
    const ok = await renderQueue.cancelJob(jobId)
    return { success: ok }
  }, 'RENDER_FAILED')

  safeIpcMain('render:jobs', async () => {
    await renderQueue.ensureReady()
    const jobs: RenderJobSummary[] = renderQueue.getAllJobs().map(j => ({
      id: j.id,
      contentId: j.contentId,
      status: j.status,
      progress: j.progress,
      error: j.error,
      createdAt: j.createdAt,
      completedAt: j.completedAt
    }))
    return { success: true, data: jobs }
  }, 'RENDER_FAILED')

  safeIpcMain('render:thumbnail', async (_event, videoPath: string, outputPath: string) => {
    // PRN-001: confine both paths derived from the renderer.
    const confinedVideo = confineRenderPath('render:thumbnail', videoPath)
    const confinedOutput = confineRenderPath('render:thumbnail', outputPath)
    if (!confinedVideo || !confinedOutput) {
      throw new Error('render:thumbnail requires paths inside the workspace')
    }
    const ok = await generateThumbnail(confinedVideo, confinedOutput)
    return { success: ok, data: confinedOutput }
  }, 'RENDER_FAILED')

  safeIpcMain('render:set-concurrency', async (_event, n: number) => {
    renderQueue.setMaxConcurrent(n)
    return { success: true }
  }, 'RENDER_FAILED')
}
