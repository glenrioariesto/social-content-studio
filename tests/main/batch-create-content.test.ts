import { describe, it, expect, mock, beforeAll } from 'bun:test'
import { _setTestWorkspaceRoot, _setTestBootstrapSettingsPath } from '@main/services/workspace-root'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

let renderVideoImpl: (...args: any[]) => Promise<any>
let generateThumbnailImpl: (...args: any[]) => Promise<any>
let wsRoot = ''
const ipcHandlers = new Map<string, (...args: any[]) => Promise<any>>()


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
  shell: { openPath: async () => '' },
  BrowserWindow: class {}
}))

const { initBatchIpc } = await import('../../src/main/ipc/batch')
const { loadDirEntries } = await import('../../src/main/ipc/filesystem')
const { renderQueue } = await import('../../src/main/services/render-queue')
const { validateContent } = await import('@shared/validators')

async function withTmpWs<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'batch-'))
  _setTestWorkspaceRoot(root)
  _setTestBootstrapSettingsPath(join(root, 'settings.json'))
  try {
    renderQueue.setPersistFile(join(root, 'queue.json'))
    renderQueue.setMaxConcurrent(1)
    renderQueue.setContentStateHooks({})
    return await fn(root)
  } finally {
    _setTestWorkspaceRoot(null)
    _setTestBootstrapSettingsPath(null)
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

describe('Batch IPC canonical layout + enqueue (REQ-003 / PRN-002)', () => {
  it('creates content docs in canonical layout visible via loadDirEntries and valid per validateContent', async () => {
    await withTmpWs(async (root) => {
      ipcHandlers.clear()
      initBatchIpc()

      const res = await invoke('batch:create-content', 'acc-1', [
        { title: 'First post', caption: 'Hello', hashtags: 'studio #social' },
        { title: 'Second post' }
      ], 'tmpl-1')
      expect(res.success).toBe(true)
      expect(res.data.ids).toHaveLength(2)

      for (const id of res.data.ids as string[]) {
        const raw = JSON.parse(await readFile(join(root, 'contents', id, 'content.json'), 'utf-8'))
        expect(raw.id).toBe(id)
        expect(raw.status).toBe('draft')
        expect(raw.accountId).toBe('acc-1')
        expect(raw.templateId).toBe('tmpl-1')
      }

      const entries = await loadDirEntries(root, 'contents', 'content.json', validateContent)
      expect(entries.filter(e => e.kind === 'valid')).toHaveLength(2)
      expect(entries.some(e => e.kind !== 'valid')).toBe(false)
    })
  })

  it('enqueue-all routes content through the legal flow into real render jobs', async () => {
    await withTmpWs(async (root) => {
      ipcHandlers.clear()
      initBatchIpc()
      renderVideoImpl = async (opts: any) => ({ success: true, outputPath: opts.outputPath })
      generateThumbnailImpl = async () => true

      const created = await invoke('batch:create-content', 'acc-1', [
        { title: 'First post' },
        { title: 'Second post' }
      ])
      const ids = created.data.ids as string[]

      const res = await invoke('batch:enqueue-all', ids, 'instagram-reels')
      expect(res.success).toBe(true)
      expect(res.data.added).toBe(2)

      // After enqueue the content must sit at the legal `rendering` state.
      for (const id of ids) {
        const raw = JSON.parse(await readFile(join(root, 'contents', id, 'content.json'), 'utf-8'))
        expect(['rendering', 'ready-to-post']).toContain(raw.status)
      }

      const jobs = renderQueue.getAllJobs().filter(j => ids.includes(j.contentId))
      expect(jobs).toHaveLength(2)
      for (const job of jobs) {
        expect(job.status).toMatch(/^(waiting|rendering|completed)$/)
        expect(job.options.outputPath).toBe(join(root, 'contents', job.contentId, 'output.mp4'))
      }

      await waitFor(() => jobs.every(j => j.status === 'completed'))
      const completed = renderQueue.getAllJobs().filter(j => ids.includes(j.contentId))
      expect(completed).toHaveLength(2)
      expect(completed.every(j => j.status === 'completed')).toBe(true)
    })
  })

  it('enqueue-all refuses an item already actively rendering (TASK-202 sync)', async () => {
    await withTmpWs(async (root) => {
      ipcHandlers.clear()
      initBatchIpc()
      let releaseRender: () => void = () => {}
      renderVideoImpl = () => new Promise<{ success: boolean; error?: string }>((resolve) => { releaseRender = () => resolve({ success: false, error: 'cancelled' }) })
      generateThumbnailImpl = async () => true

      const created = await invoke('batch:create-content', 'acc-1', [{ title: 'Solo post' }])
      const [id] = created.data.ids as string[]

      const first = await invoke('batch:enqueue-all', [id], 'instagram-reels')
      expect(first.success).toBe(true)
      expect(first.data.added).toBe(1)

      const second = await invoke('batch:enqueue-all', [id], 'instagram-reels')
      expect(second.success).toBe(true)
      expect(second.data.added).toBe(0)

      releaseRender()
    })
  })
})