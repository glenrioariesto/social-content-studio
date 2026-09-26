import { describe, it, expect, mock } from 'bun:test'
import { _setTestWorkspaceRoot, _setTestBootstrapSettingsPath } from '@main/services/workspace-root'
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

let renderVideoImpl: (...args: any[]) => Promise<any>
let generateThumbnailImpl: (...args: any[]) => Promise<any>
let wsRoot = ''
const ipcHandlers = new Map<string, (...args: any[]) => Promise<any>>()

mock.module('C:/project/social-content-studio/src/main/errors.ts', () => ({
  logInfo: () => {},
  logError: () => {},
  logWarning: () => {}
}))

mock.module('C:/project/social-content-studio/src/main/services/render-engine.ts', () => ({
  renderVideo: (...args: any[]) => renderVideoImpl(...args),
  generateThumbnail: (...args: any[]) => generateThumbnailImpl(...args)
}))


mock.module('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => Promise<any>) => { ipcHandlers.set(channel, fn) },
    on: () => {}
  },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
  safeStorage: { isEncryptionAvailable: () => false },
  app: { on: () => {}, getPath: () => '' },
  BrowserWindow: class {}
}))

const { RenderQueue } = await import('../../src/main/services/render-queue')
const { initRenderIpc } = await import('../../src/main/ipc/render')

function makeOptions(outputPath: string) {
  return { inputPath: 'in.mp4', outputPath, width: 1080, height: 1920, fps: 30 }
}

async function withTmpWs<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'rpipeline-'))
  wsRoot = root
  _setTestWorkspaceRoot(root)
  _setTestBootstrapSettingsPath(join(root, 'settings.json'))
  try {
    return await fn(root)
  } finally {
    _setTestWorkspaceRoot(undefined)
    wsRoot = ''
    await rm(root, { recursive: true, force: true })
  }
}

function invoke(channel: string, ...args: unknown[]) {
  const fn = ipcHandlers.get(channel)
  if (!fn) throw new Error(`No handler for ${channel}`)
  return fn({} as never, ...args)
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
async function waitFor(cond: () => boolean, timeout = 3000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out')
    await delay(5)
  }
}

const CONTENT_RENDERING = {
  id: 'c1',
  title: 'Test content',
  status: 'rendering',
  accountId: 'acc-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
}

const CONTENT_FAILED = {
  ...CONTENT_RENDERING,
  id: 'c2',
  title: 'Content for failure test'
}

describe('Render pipeline content-state hooks (REQ-001 / SPEC-02)', () => {
  it('completed job transitions content to ready-to-post and writes output', async () => {
    await withTmpWs(async (root) => {
      renderVideoImpl = async (opts: any) => ({ success: true, outputPath: opts.outputPath })
      generateThumbnailImpl = async () => true

      const dir = join(root, 'contents', 'c1')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'content.json'), JSON.stringify(CONTENT_RENDERING), 'utf-8')

      const q = new RenderQueue()
      q.setPersistFile(join(root, 'queue.json'))
      q.setContentStateHooks({
        onJobCompleted: async (job, thumbnailPath) => {
          const raw = await readFile(join(root, 'contents', job.contentId, 'content.json'), 'utf-8')
          const c = JSON.parse(raw) as any
          c.status = 'ready-to-post'
          c.output = { video: job.options.outputPath, thumbnail: thumbnailPath }
          c.updatedAt = new Date().toISOString()
          await writeFile(join(root, 'contents', job.contentId, 'content.json'), JSON.stringify(c), 'utf-8')
        },
        onJobFailed: async () => {}
      })

      await q.addJob({ id: 'j1', contentId: 'c1', options: makeOptions(join(root, 'out1.mp4')) })
      await waitFor(() => q.getJob('j1')?.status === 'completed')
      const c = JSON.parse(await readFile(join(root, 'contents', 'c1', 'content.json'), 'utf-8'))
      expect(c.status).toBe('ready-to-post')
      expect(c.output.video).toBe(join(root, 'out1.mp4'))
      expect(c.output.thumbnail).toBeTruthy()
    })
  })

  it('failed job transitions content to failed', async () => {
    await withTmpWs(async (root) => {
      renderVideoImpl = async () => ({ success: false, error: 'ffmpeg crashed' })
      generateThumbnailImpl = async () => true

      const dir = join(root, 'contents', 'c2')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'content.json'), JSON.stringify(CONTENT_FAILED), 'utf-8')

      const q = new RenderQueue()
      q.setPersistFile(join(root, 'queue.json'))
      q.setContentStateHooks({
        onJobCompleted: async () => {},
        onJobFailed: async (job) => {
          const raw = await readFile(join(root, 'contents', job.contentId, 'content.json'), 'utf-8')
          const c = JSON.parse(raw) as any
          c.status = 'failed'
          c.updatedAt = new Date().toISOString()
          await writeFile(join(root, 'contents', job.contentId, 'content.json'), JSON.stringify(c), 'utf-8')
        }
      })

      await q.addJob({ id: 'j2', contentId: 'c2', options: makeOptions(join(root, 'out2.mp4')) })
      await waitFor(() => q.getJob('j2')?.status === 'failed')
      const c = JSON.parse(await readFile(join(root, 'contents', 'c2', 'content.json'), 'utf-8'))
      expect(c.status).toBe('failed')
    })
  })

  it('render:start refuses duplicate enqueue while a job is active', async () => {
    await withTmpWs(async (root) => {
      ipcHandlers.clear()
      initRenderIpc({ isDestroyed: () => false, webContents: { send: () => {} } } as never)

      let releaseFirst: () => void = () => {}
      renderVideoImpl = () => new Promise<{ success: boolean; error?: string }>((resolve) => { releaseFirst = () => resolve({ success: false, error: 'cancelled' }) })
      generateThumbnailImpl = async () => true

      const dir = join(root, 'contents', 'c3')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'video.mp4'), 'dummy', 'utf-8')

      const firstRes = await invoke('render:start', {
        contentId: 'c3',
        inputPath: join(root, 'contents', 'c3', 'video.mp4'),
        outputPath: join(root, 'renders', 'out-c3.mp4')
      })
      expect(firstRes.success).toBe(true)
      await waitFor(() => invoke('render:jobs').then((res: any) => res.data?.some((j: any) => j.contentId === 'c3' && j.status === 'rendering')))

      const secondRes = await invoke('render:start', {
        contentId: 'c3',
        inputPath: join(root, 'contents', 'c3', 'video.mp4'),
        outputPath: join(root, 'renders', 'out-c3-v2.mp4')
      })
      expect(secondRes.success).toBe(false)
      expect(secondRes.errorCode).toBe('RENDER_FAILED')

      releaseFirst()
    })
  })
})
