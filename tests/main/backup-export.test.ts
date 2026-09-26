import { describe, it, expect, mock, jest, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtemp, rm, readFile, readdir, mkdir } from 'fs/promises'
import { tmpdir } from 'os'

const ipcHandlers = new Map<string, (...args: any[]) => Promise<any>>()
let testDir = ''
let bootstrapSettingsPath = ''

const wsModPath = import.meta.resolve('../../src/main/services/workspace-root.ts')
mock.module(wsModPath, () => ({
  getWorkspaceRoot: () => testDir,
  BOOTSTRAP_SETTINGS_PATH: bootstrapSettingsPath
}))

const persistModPath = import.meta.resolve('../../src/main/services/persistence.ts')
mock.module(persistModPath, () => ({
  atomicWriteJson: jest.fn(),
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
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn()
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

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'ws-backup-'))
  bootstrapSettingsPath = join(testDir, 'settings.json')
  await mkdir(join(testDir, 'contents'), { recursive: true })
  ipcHandlers.clear()
  initBackupIpc()
})

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true })
})

// SEC-002 is exercised in the hardened direction (guard enforced, no whitelist
// bypass) while the log-emission requirement from SEC-003 / AC-003 is asserted.

describe('backup:export (AC-004 / SEC-002 / SEC-003)', () => {
  it('writes a zip under the workspace root when no output path is given and logs channel+path', async () => {
    const res = await invoke('backup:export')

    expect(res.success).toBe(true)
    expect(typeof res.data).toBe('string')
    expect(res.data.startsWith(testDir)).toBe(true)
    expect(res.data.endsWith('.zip')).toBe(true)

    const files = await readdir(testDir)
    const zip = files.find((f) => f.endsWith('.zip'))
    expect(zip).toBeTruthy()
    const bytes = await readFile(join(testDir, zip as string))
    expect(bytes.length).toBeGreaterThan(0)

    const logInfo = (await import('../../src/main/errors')).logInfo as jest.Mock
    expect(logInfo).toHaveBeenCalled()
  })

  it('refuses an output path escaping the workspace and records the refusal in the log', async () => {
    const escaped = join(tmpdir(), 'outside-backup.zip')
    const res = await invoke('backup:export', escaped)

    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('FS_PERMISSION_DENIED')

    const logError = (await import('../../src/main/errors')).logError as jest.Mock
    expect(logError).toHaveBeenCalled()
  })
})