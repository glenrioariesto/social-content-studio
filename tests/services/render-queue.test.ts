import { describe, it, expect, mock } from 'bun:test'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

let renderVideoImpl: (opts: {
  inputPath: string
  outputPath: string
  width: number
  height: number
  fps: number
  onProgress?: (p: number) => void
}) => Promise<{ success: boolean; outputPath?: string; error?: string }>
let generateThumbnailImpl: (videoPath: string, outputPath: string) => Promise<boolean>


mock.module('C:/project/social-content-studio/src/main/services/render-engine.ts', () => ({
  renderVideo: (opts: Parameters<typeof renderVideoImpl>[0]) => renderVideoImpl(opts),
  generateThumbnail: (videoPath: string, outputPath: string) => generateThumbnailImpl(videoPath, outputPath)
}))

const { RenderQueue } = await import('../../src/main/services/render-queue')

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function waitFor(cond: () => boolean, timeout = 3000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out')
    await delay(5)
  }
}

function makeOptions(outputPath: string) {
  return {
    inputPath: 'input.mp4',
    outputPath,
    width: 1080,
    height: 1920,
    fps: 30,
    preset: 'medium'
  }
}

async function withTmpQueue<T>(fn: (persistFile: string) => Promise<T>, destroy = true): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'rq-'))
  const persistFile = join(dir, 'queue.json')
  try {
    return await fn(persistFile)
  } finally {
    if (destroy) await rm(dir, { recursive: true, force: true })
  }
}

describe('RenderQueue', () => {
  it('restores a persisted waiting job and resumes it; crashed rendering jobs become failed', async () => {
    await withTmpQueue(async (persistFile) => {
      const rendered: string[] = []
      renderVideoImpl = async (opts) => {
        rendered.push(opts.outputPath)
        return { success: true, outputPath: opts.outputPath }
      }
      generateThumbnailImpl = async () => true

      const persisted = JSON.stringify([
        {
          id: 'resume-1',
          contentId: 'c1',
          status: 'waiting',
          progress: 0,
          options: makeOptions('out-resume.mp4'),
          createdAt: new Date().toISOString()
        },
        {
          id: 'crashed-1',
          contentId: 'c2',
          status: 'rendering',
          progress: 50,
          options: makeOptions('out-crashed.mp4'),
          createdAt: new Date().toISOString()
        }
      ])
      await writeFile(persistFile, persisted, 'utf-8')

      const q = new RenderQueue()
      q.setPersistFile(persistFile)
      await q.init()

      await waitFor(() => q.getJob('resume-1')?.status === 'completed')
      expect(rendered).toContain('out-resume.mp4')
      expect(rendered).not.toContain('out-crashed.mp4')
      expect(q.getJob('resume-1')?.completedAt).toBeTruthy()
      const crashed = q.getJob('crashed-1')
      expect(crashed?.status).toBe('failed')
      expect(crashed?.error).toBe('Interrupted by shutdown')
    })
  })

  it('runs two waiting jobs concurrently when maxConcurrent=2', async () => {
    await withTmpQueue(async (persistFile) => {
      let inFlight = 0
      let peak = 0
      renderVideoImpl = (opts) => {
        inFlight++
        peak = Math.max(peak, inFlight)
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight--
            resolve({ success: true, outputPath: opts.outputPath })
          }, 30)
        })
      }
      generateThumbnailImpl = async () => true

      const q = new RenderQueue()
      q.setPersistFile(persistFile)
      await q.init()
      q.setMaxConcurrent(2)

      await q.addJob({ id: 'a', contentId: 'c1', options: makeOptions('out-a.mp4') })
      await q.addJob({ id: 'b', contentId: 'c2', options: makeOptions('out-b.mp4') })

      await waitFor(() => q.getAllJobs().filter((j) => j.status === 'completed').length === 2, 5000)
      expect(peak).toBe(2)
    })
  })

  it('keeps the job completed when thumbnail generation fails', async () => {
    await withTmpQueue(async (persistFile) => {
      renderVideoImpl = async (opts) => ({ success: true, outputPath: opts.outputPath })
      generateThumbnailImpl = async () => {
        throw new Error('thumb boom')
      }

      const q = new RenderQueue()
      q.setPersistFile(persistFile)
      await q.init()
      await q.addJob({ id: 'thumb', contentId: 'c1', options: makeOptions('out-thumb.mp4') })

      await waitFor(() => q.getJob('thumb')?.status === 'completed')
      const job = q.getJob('thumb')
      expect(job?.status).toBe('completed')
      expect(job?.error).toBeUndefined()
    })
  })

  it('cancels a queued waiting job and removes any job', async () => {
    await withTmpQueue(async (persistFile) => {
      const renderCalled: string[] = []
      let releaseFirst: () => void = () => {}
      renderVideoImpl = (opts) => {
        renderCalled.push(opts.outputPath)
        if (renderCalled.length === 1) {
          return new Promise((resolve) => {
            releaseFirst = () => resolve({ success: true, outputPath: opts.outputPath })
          })
        }
        return Promise.resolve({ success: true, outputPath: opts.outputPath })
      }
      generateThumbnailImpl = async () => true

      const q = new RenderQueue()
      q.setPersistFile(persistFile)
      await q.init()
      q.setMaxConcurrent(1)

      await q.addJob({ id: 'first', contentId: 'c1', options: makeOptions('out-first.mp4') })
      await waitFor(() => renderCalled.length === 1)

      await q.addJob({ id: 'second', contentId: 'c2', options: makeOptions('out-second.mp4') })
      const cancelled = await q.cancelJob('second')
      expect(cancelled).toBe(true)
      expect(q.getJob('second')?.status).toBe('failed')
      expect(q.getJob('second')?.error).toBe('Cancelled')

      releaseFirst()
      await waitFor(() => q.getJob('first')?.status === 'completed')
      expect(renderCalled).toEqual(['out-first.mp4'])

      const removed = await q.removeJob('first')
      expect(removed).toBe(true)
      expect(q.getJob('first')).toBeUndefined()
    })
  })
})