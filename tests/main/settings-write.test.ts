import { describe, it, expect, mock, beforeEach, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { _setTestWorkspaceRoot, _setTestBootstrapSettingsPath } from '@main/services/workspace-root'

const ipcHandlers = ((globalThis as any).__testIpcHandlers ||= new Map<string, (...args: any[]) => Promise<any>>())
let wsRoot = ''
let testBootstrapDir = ''
let testBootstrapFile = ''


mock.module('electron', () => ({
  ipcMain: { handle: (c: string, fn: (...a: any[]) => Promise<any>) => { ipcHandlers.set(c, fn) }, on: () => {} },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
  app: { on: () => {}, getPath: () => '' },
  shell: { openPath: async () => '' },
  safeStorage: { isEncryptionAvailable: () => false, encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() },
  BrowserWindow: class {}
}))

const { initBackupIpc } = await import('../../src/main/ipc/backup')

function invoke(channel: string, ...args: unknown[]) {
  const fn = ipcHandlers.get(channel)
  if (!fn) throw new Error(`No handler for ${channel}`)
  return fn({} as never, ...args)
}

beforeEach(async () => {
  if (testBootstrapDir) {
    await rm(testBootstrapDir, { recursive: true, force: true })
  }
  testBootstrapDir = await mkdtemp(join(tmpdir(), 'bootstrap-'))
  testBootstrapFile = join(testBootstrapDir, 'settings.json')
  _setTestBootstrapSettingsPath(testBootstrapFile)
  _setTestWorkspaceRoot(null)
  ipcHandlers.clear()
  initBackupIpc()
})

afterAll(async () => {
  _setTestWorkspaceRoot(null)
  _setTestBootstrapSettingsPath(null)
  if (testBootstrapDir) {
    await rm(testBootstrapDir, { recursive: true, force: true })
  }
})

describe('GH-004: settings write targets the bootstrap settings file', () => {
  it('persists to bootstrap settings file, not the active workspace root', async () => {
    await withRealDir(async (nextRoot) => {
      // Simulate: the app is currently running against a custom workspace root.
      wsRoot = nextRoot
      _setTestWorkspaceRoot(wsRoot)

      const settings = { workspacePath: nextRoot, defaultPreset: 'tiktok' }
      const res = await invoke('settings:write', settings)

      expect(res.success).toBe(true)
      const saved = JSON.parse(await readFile(testBootstrapFile, 'utf-8'))
      expect(saved).toEqual(settings)
    })
  })

  it('rejects a workspacePath that does not exist or is not a directory', async () => {
    wsRoot = 'C:/custom-workspace'
    ipcHandlers.clear()
    initBackupIpc()

    const res = await invoke('settings:write', { workspacePath: 'Z:/no-such-dir-xyz' })
    expect(res.success).toBe(false)
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