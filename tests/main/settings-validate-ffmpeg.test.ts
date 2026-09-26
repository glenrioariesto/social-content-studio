import { describe, it, expect, mock, jest, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
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

interface FakeProc {
  on: (event: string, cb: (code?: number) => void) => FakeProc
  emit: (event: string, code?: number) => void
}
let spawnImpl: () => FakeProc = () => {
  const handlers = new Map<string, (code?: number) => void>()
  const proc: FakeProc = {
    on: (event, cb) => { handlers.set(event, cb); return proc },
    emit: (event, code) => { handlers.get(event)?.(code) }
  }
  return proc
}

mock.module('electron', () => ({
  ipcMain: { handle: (c: string, fn: (...a: any[]) => Promise<any>) => { ipcHandlers.set(c, fn) }, on: () => {} },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
  app: { on: () => {}, getPath: () => '' },
  BrowserWindow: class {}
}))

mock.module('child_process', () => ({
  spawn: jest.fn(() => spawnImpl())
}))

const { initBackupIpc } = await import('../../src/main/ipc/backup')

function invoke(channel: string, ...args: unknown[]) {
  const fn = ipcHandlers.get(channel)
  if (!fn) throw new Error(`No handler for ${channel}`)
  return fn({} as never, ...args)
}

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'ws-ffmpeg-'))
  bootstrapSettingsPath = join(testDir, 'settings.json')
  initBackupIpc()
})

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('REQ-005: settings:validate-ffmpeg reports honest validity', () => {
  it('returns found:false for a non-existent path without spawning', async () => {
    const res = await invoke('settings:validate-ffmpeg', join(testDir, 'no-ffmpeg.exe'))
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: false, isFile: false })
  })

  it('returns found:false for a directory without spawning', async () => {
    const dir = join(testDir, 'not-a-binary')
    await mkdir(dir)
    const res = await invoke('settings:validate-ffmpeg', dir)
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: false, isFile: false })
  })

  it('returns isFile:false when the binary spawns but exits non-zero', async () => {
    const bin = join(testDir, 'fake-ffmpeg.exe')
    await writeFile(bin, '#!/bin/sh\nexit 1', 'utf-8')
    let latest!: FakeProc
    spawnImpl = () => { latest = fakeProc(); return latest }

    const invokePromise = invoke('settings:validate-ffmpeg', bin)
    latest.emit('close', 1)
    const res = await invokePromise

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: true, isFile: false })
  })

  it('returns isFile:true when the binary spawns and exits zero', async () => {
    const bin = join(testDir, 'real-ffmpeg.exe')
    await writeFile(bin, '#!/bin/sh\nexit 0', 'utf-8')
    let latest!: FakeProc
    spawnImpl = () => { latest = fakeProc(); return latest }

    const invokePromise = invoke('settings:validate-ffmpeg', bin)
    latest.emit('close', 0)
    const res = await invokePromise

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: true, isFile: true })
  })

  it('returns isFile:false when spawn emits an error event', async () => {
    const bin = join(testDir, 'broken-ffmpeg.exe')
    await writeFile(bin, 'not-an-executable', 'utf-8')
    let latest!: FakeProc
    spawnImpl = () => { latest = fakeProc(); return latest }

    const invokePromise = invoke('settings:validate-ffmpeg', bin)
    latest.emit('error')
    const res = await invokePromise

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: true, isFile: false })
  })
})

function fakeProc(): FakeProc {
  const handlers = new Map<string, (code?: number) => void>()
  const proc: FakeProc = {
    on: (event, cb) => { handlers.set(event, cb); return proc },
    emit: (event, code) => { handlers.get(event)?.(code) }
  }
  return proc
}