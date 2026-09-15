import { describe, it, expect, mock, beforeEach, jest, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtemp, rm, writeFile, mkdir, unlink } from 'fs/promises'
import { tmpdir } from 'os'

const ipcHandlers = new Map<string, (...args: any[]) => Promise<any>>()
let bootstrapSettingsPath = ''
let wsRoot = ''

// The mock factory is evaluated once at import time, so the temp dir must be
// created BEFORE importing backup.ts. Per-test state is managed in beforeEach.
const testDir = await mkdtemp(join(tmpdir(), 'ws-status-'))
bootstrapSettingsPath = join(testDir, 'settings.json')

const wsModPath = import.meta.resolve('../../src/main/services/workspace-root.ts')
mock.module(wsModPath, () => ({
  getWorkspaceRoot: () => wsRoot,
  BOOTSTRAP_SETTINGS_PATH: bootstrapSettingsPath
}))

const persistModPath = import.meta.resolve('../../src/main/services/persistence.ts')
mock.module(persistModPath, () => ({
  atomicWriteJson: async (file: string, data: unknown) => { await writeFile(file, JSON.stringify(data, null, 2), 'utf-8') },
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
  dialog: {
    showOpenDialog: jest.fn(async () => ({ canceled: false, filePaths: ['C:/chosen/workspace'] }))
  },
  app: { on: () => {}, getPath: () => '' },
  BrowserWindow: class {}
}))

const { initBackupIpc } = await import('../../src/main/ipc/backup')

function invoke(channel: string, ...args: unknown[]) {
  const fn = ipcHandlers.get(channel)
  if (!fn) throw new Error(`No handler for ${channel}`)
  return fn({} as never, ...args)
}

beforeEach(async () => {
  // Reset to a "first run" state between tests.
  await rm(bootstrapSettingsPath, { force: true })
  wsRoot = join(process.cwd(), 'workspace')
  ipcHandlers.clear()
  initBackupIpc()
})

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('GH-004 AC-008: settings:status drives the guided setup state', () => {
  it('reports valid:false when the configured workspace folder is missing', async () => {
    const configured = join(testDir, 'ghost-folder')
    await writeFile(bootstrapSettingsPath, JSON.stringify({ workspacePath: configured }))

    const res = await invoke('settings:status')

    expect(res.success).toBe(true)
    expect(res.data.valid).toBe(false)
    expect(res.data.configuredRoot).toBe(configured)
  })

  it('reports valid:false when the configured path is a file, not a directory', async () => {
    const configured = join(testDir, 'not-a-dir.txt')
    await writeFile(configured, 'x')
    await writeFile(bootstrapSettingsPath, JSON.stringify({ workspacePath: configured }))

    const res = await invoke('settings:status')

    expect(res.success).toBe(true)
    expect(res.data.valid).toBe(false)
    expect(res.data.configuredRoot).toBe(configured)
  })

  it('reports valid:true when the configured folder exists', async () => {
    const configured = join(testDir, 'real-workspace')
    await mkdir(configured)
    await writeFile(bootstrapSettingsPath, JSON.stringify({ workspacePath: configured }))

    const res = await invoke('settings:status')

    expect(res.success).toBe(true)
    expect(res.data.valid).toBe(true)
    expect(res.data.configuredRoot).toBe(configured)
    expect(res.data.activeRoot).toBe(configured)
  })

  it('falls back to the default root when no settings file exists (first run)', async () => {
    const res = await invoke('settings:status')

    expect(res.success).toBe(true)
    expect(res.data.valid).toBe(true)
    expect(res.data.configuredRoot).toBeNull()
    expect(res.data.activeRoot).toBe(join(process.cwd(), 'workspace'))
  })

  it('settings:pick-workspace returns the folder chosen by the native dialog', async () => {
    const res = await invoke('settings:pick-workspace')

    expect(res.success).toBe(true)
    expect(res.data).toBe('C:/chosen/workspace')
  })
})