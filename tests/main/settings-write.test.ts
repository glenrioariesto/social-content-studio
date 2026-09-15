import { describe, it, expect, mock } from 'bun:test'
import { join, dirname } from 'path'
import { mkdtemp, rm, writeFile, rename, readFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'

const ipcHandlers = new Map<string, (...args: any[]) => Promise<any>>()
let wsRoot = ''
let writtenPaths: string[] = []
let writtenPayloads: unknown[] = []

const wsModPath = import.meta.resolve('../../src/main/services/workspace-root.ts')
mock.module(wsModPath, () => ({
  getWorkspaceRoot: () => wsRoot,
  BOOTSTRAP_SETTINGS_PATH: join(process.cwd(), 'workspace', 'config', 'settings.json')
}))

const persistModPath = import.meta.resolve('../../src/main/services/persistence.ts')
mock.module(persistModPath, () => ({
  atomicWriteJson: async (file: string, data: unknown) => {
    writtenPaths.push(file)
    writtenPayloads.push(data)
    const dir = dirname(file)
    const tmp = join(dir, `.${randomUUID()}.tmp`)
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    await rename(tmp, file)
  },
  mergeKnownFields: <T extends object>(base: T, patch: Record<string, unknown>, permit: ReadonlyArray<keyof T>): T => {
    const out: T = { ...base }
    for (const key of permit) {
      if (key in patch) {
        ;(out as Record<string, unknown>)[key as string] = patch[key as string]
      }
    }
    return out
  }
}))

const errorsModPath = import.meta.resolve('../../src/main/errors.ts')
mock.module(errorsModPath, () => ({
  logInfo: () => {},
  logError: () => {},
  logWarning: () => {}
}))

mock.module('electron', () => ({
  ipcMain: { handle: (c: string, fn: (...a: any[]) => Promise<any>) => { ipcHandlers.set(c, fn) }, on: () => {} },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
  app: { on: () => {}, getPath: () => '' },
  BrowserWindow: class {}
}))

const { initBackupIpc } = await import('../../src/main/ipc/backup')

function invoke(channel: string, ...args: unknown[]) {
  const fn = ipcHandlers.get(channel)
  if (!fn) throw new Error(`No handler for ${channel}`)
  return fn({} as never, ...args)
}

describe('GH-004: settings write targets the bootstrap settings file', () => {
  it('persists to cwd/workspace/config/settings.json, not the active workspace root', async () => {
    writtenPaths = []
    writtenPayloads = []
    await withRealDir(async (nextRoot) => {
      ipcHandlers.clear()
      // Simulate: the app is currently running against a custom workspace root.
      wsRoot = nextRoot
      initBackupIpc()

      const settings = { workspacePath: nextRoot, defaultPreset: 'tiktok' }
      const res = await invoke('settings:write', settings)

      expect(res.success).toBe(true)
      expect(writtenPaths.length).toBe(1)
      expect(writtenPaths[0]).toBe(join(process.cwd(), 'workspace', 'config', 'settings.json'))
      expect(writtenPaths[0]).not.toContain('custom-workspace')
      expect(writtenPaths[0]).not.toContain(nextRoot)
      expect(writtenPayloads[0]).toEqual(settings)
    })
  })

  it('rejects a workspacePath that does not exist or is not a directory', async () => {
    writtenPaths = []
    wsRoot = 'C:/custom-workspace'
    ipcHandlers.clear()
    initBackupIpc()

    const res = await invoke('settings:write', { workspacePath: 'Z:/no-such-dir-xyz' })
    expect(res.success).toBe(false)
    expect(writtenPaths.length).toBe(0)
  })
})

async function withRealDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'ws-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}