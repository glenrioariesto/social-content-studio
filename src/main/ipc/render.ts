import { BrowserWindow } from 'electron'
import { safeIpcMain } from './safe-handler'
import { renderQueue, type RenderJob } from '@main/services/render-queue'
import { renderVideo, generateThumbnail } from '@main/services/render-engine'
import { logInfo } from '@main/errors'
import type { RenderJobSummary } from '@shared/render'

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
    const job = await renderQueue.addJob({
      id: `render-${Date.now()}`,
      contentId: jobData.contentId,
      options: {
        inputPath: jobData.inputPath,
        outputPath: jobData.outputPath,
        width: jobData.width || 1080,
        height: jobData.height || 1920,
        fps: jobData.fps || 30,
        overlayPath: jobData.overlayPath,
        overlayPosition: jobData.overlayPosition,
        preset: jobData.preset
      }
    })
    logInfo(`Render queued: ${job.id} for content ${jobData.contentId}`)
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
    const ok = await generateThumbnail(videoPath, outputPath)
    return { success: ok, data: outputPath }
  }, 'RENDER_FAILED')

  safeIpcMain('render:set-concurrency', async (_event, n: number) => {
    renderQueue.setMaxConcurrent(n)
    return { success: true }
  }, 'RENDER_FAILED')
}
