import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test'
import { _setTestWorkspaceRoot, _setTestBootstrapSettingsPath } from '@main/services/workspace-root'
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// These exercise the SAME confinement guards the IPC handlers rely on, without
// spawning the full Electron app. The `fs:*` bridge, `batch:*` and `render:*`
// channels must never let a renderer-supplied path escape the workspace root.

let wsRoot = ''
const ipcHandlers = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>()

mock.module('C:/project/social-content-studio/src/main/errors.ts', () => ({
  logInfo: () => {},
  logError: () => {},
  logWarning: () => {}
}))

mock.module('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
      ipcHandlers.set(channel, fn)
    },
    on: () => {}
  },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
  safeStorage: { isEncryptionAvailable: () => false },
  app: { on: () => {}, getPath: () => '' },
  BrowserWindow: class {
    isDestroyed(): boolean { return false }
    webContents: { send: () => void } = { send: () => {} }
  }
}))

const { initFileSystemIpc } = await import('../../src/main/ipc/filesystem')
const { initBatchIpc } = await import('../../src/main/ipc/batch')
const { initRenderIpc } = await import('../../src/main/ipc/render')

async function withTmpWs<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'conf-'))
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

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = ipcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return handler(null, ...args)
}

beforeAll(() => {
  ipcHandlers.clear()
  initFileSystemIpc({ isDestroyed: () => false, webContents: { send: () => {} } } as never)
  initBatchIpc()
  initRenderIpc({ isDestroyed: () => false, webContents: { send: () => {} } } as never)
})

afterAll(async () => {
  const dirs = await readdirTmp()
  for (const dir of dirs) {
    if (dir.startsWith('conf-')) await rm(join(tmpdir(), dir), { recursive: true, force: true })
  }
})

async function readdirTmp(): Promise<string[]> {
  const { readdir } = await import('fs/promises')
  return readdir(tmpdir())
}

describe('fs/rendering/batch confinement guards (STD-01/02/03/05)', () => {
  it('fs:write-file can create a NEW file (create-mode regression)', async () => {
    await withTmpWs(async (root) => {
      await invoke('fs:mkdir', join(root, 'assets'))
      const target = join(root, 'assets', 'brand-new.txt')
      const result = await invoke('fs:write-file', target, 'hello')
      expect(result).toEqual({ success: true })
      expect(await readFile(target, 'utf-8')).toBe('hello')
    })
  })

  it('fs:mkdir can create a NEW directory', async () => {
    await withTmpWs(async (root) => {
      const target = join(root, 'assets', 'new-folder')
      const result = await invoke('fs:mkdir', target)
      expect(result).toEqual({ success: true })
      await access(target)
    })
  })

  it('fs:write-file rejects a path escaping the workspace root', async () => {
    await withTmpWs(async (root) => {
      const result = await invoke('fs:write-file', join(root, '..', 'escape.txt'), 'x')
      expect(result).toMatchObject({ success: false, errorCode: 'FS_PERMISSION_DENIED' })
    })
  })

  it('fs:read-file refuses the credentials vault (secrets deny-list)', async () => {
    await withTmpWs(async (root) => {
      await mkdir(join(root, 'config'), { recursive: true })
      await writeFile(join(root, 'config', 'repliz-credentials.enc.json'), '{"encrypted":false}', 'utf-8')
      const result = await invoke('fs:read-file', join(root, 'config', 'repliz-credentials.enc.json'))
      expect(result).toMatchObject({ success: false, errorCode: 'FS_PERMISSION_DENIED' })
    })
  })

  it('fs:read-file still serves an ordinary non-secret file', async () => {
    await withTmpWs(async (root) => {
      await mkdir(join(root, 'assets'), { recursive: true })
      await writeFile(join(root, 'assets', 'pic.txt'), 'plain', 'utf-8')
      const result = await invoke('fs:read-file', join(root, 'assets', 'pic.txt'))
      expect(result).toEqual({ success: true, data: 'plain' })
    })
  })

  it('batch:parse-csv rejects a csvPath escaping the workspace root', async () => {
    await withTmpWs(async (root) => {
      const result = await invoke('batch:parse-csv', join(root, '..', 'evil.csv'))
      expect(result).toMatchObject({ success: false, errorCode: 'FS_PERMISSION_DENIED' })
    })
  })

  it('batch:export-csv rejects an outputPath escaping the workspace root', async () => {
    await withTmpWs(async (root) => {
      const result = await invoke('batch:export-csv', join(root, '..', 'out.csv'))
      expect(result).toMatchObject({ success: false, errorCode: 'FS_PERMISSION_DENIED' })
    })
  })

  it('render:start confines input/output/overlay paths to the workspace', async () => {
    await withTmpWs(async (root) => {
      const result = await invoke('render:start', {
        contentId: 'c1',
        inputPath: join(root, '..', 'outside.mp4'),
        outputPath: join(root, 'renders', 'out.mp4')
      })
      expect(result).toMatchObject({ success: false, errorCode: 'FS_PERMISSION_DENIED' })
    })
  })

  it('render:start rejects a missing inputPath', async () => {
    await withTmpWs(async () => {
      const result = await invoke('render:start', { contentId: 'c1' })
      expect(result).toMatchObject({ success: false })
    })
  })
})