import { describe, it, expect, mock, jest, spyOn, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtemp, rm, readFile, readdir, mkdir } from 'fs/promises'
import { tmpdir } from 'os'

const ipcHandlers = ((globalThis as any).__testIpcHandlers ||= new Map<string, (...args: any[]) => Promise<any>>())
let testDir = ''
let bootstrapSettingsPath = ''

import { _setTestWorkspaceRoot, _setTestBootstrapSettingsPath } from '@main/services/workspace-root'

mock.module('electron', () => ({
  ipcMain: { handle: (c: string, fn: (...a: any[]) => Promise<any>) => { ipcHandlers.set(c, fn) }, on: () => {} },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
  app: { on: () => {}, getPath: () => '' },
  shell: { openPath: async () => '' },
  safeStorage: { isEncryptionAvailable: () => false, encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() },
  BrowserWindow: class {}
}))

const errors = await import('../../src/main/errors')
const logInfoSpy = spyOn(errors, 'logInfo')
const logErrorSpy = spyOn(errors, 'logError')

const { initBackupIpc } = await import('../../src/main/ipc/backup')

function invoke(channel: string, ...args: unknown[]) {
  const fn = ipcHandlers.get(channel)
  if (!fn) throw new Error(`No handler for ${channel}`)
  return fn({} as never, ...args)
}

describe('backup:export (AC-004 / SEC-002 / SEC-003)', () => {
  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'ws-backup-'))
    bootstrapSettingsPath = join(testDir, 'settings.json')
    _setTestWorkspaceRoot(testDir)
    _setTestBootstrapSettingsPath(bootstrapSettingsPath)
    await mkdir(join(testDir, 'contents'), { recursive: true })
    ipcHandlers.clear()
    initBackupIpc()
  })

  afterAll(async () => {
    _setTestWorkspaceRoot(null)
    _setTestBootstrapSettingsPath(null)
    await rm(testDir, { recursive: true, force: true })
  })

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

    expect(logInfoSpy).toHaveBeenCalled()
  })

  it('refuses an output path escaping the workspace and records the refusal in the log', async () => {
    const escaped = join(tmpdir(), 'outside-backup.zip')
    const res = await invoke('backup:export', escaped)

    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('FS_PERMISSION_DENIED')

    expect(logErrorSpy).toHaveBeenCalled()
  })
})