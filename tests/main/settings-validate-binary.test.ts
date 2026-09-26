import { describe, it, expect, mock, jest, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'

const ipcHandlers = ((globalThis as any).__testIpcHandlers ||= new Map<string, (...args: any[]) => Promise<any>>())
let testDir = ''
let bootstrapSettingsPath = ''

import { _setTestWorkspaceRoot, _setTestBootstrapSettingsPath } from '@main/services/workspace-root'


interface FakeProc {
  on: (event: string, cb: (code?: number) => void) => FakeProc
  emit: (event: string, code?: number) => void
  stdout: { on: (event: string, cb: (data: Buffer) => void) => void }
  stderr: { on: (event: string, cb: (data: Buffer) => void) => void }
  emitOutput: (str: string) => void
}
let spawnImpl: () => FakeProc = () => {
  const handlers = new Map<string, (code?: number) => void>()
  const stdoutHandlers = new Map<string, (data: Buffer) => void>()
  const stderrHandlers = new Map<string, (data: Buffer) => void>()
  const proc: FakeProc = {
    on: (event, cb) => { handlers.set(event, cb); return proc },
    emit: (event, code) => { handlers.get(event)?.(code) },
    stdout: { on: (event, cb) => stdoutHandlers.set(event, cb) },
    stderr: { on: (event, cb) => stderrHandlers.set(event, cb) },
    emitOutput: (str: string) => {
       const cb = stdoutHandlers.get('data');
       if (cb) cb(Buffer.from(str))
    }
  }
  return proc
}

mock.module('electron', () => ({
  ipcMain: { handle: (c: string, fn: (...a: any[]) => Promise<any>) => { ipcHandlers.set(c, fn) }, on: () => {} },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
  app: { on: () => {}, getPath: () => '' },
  shell: { openPath: async () => '' },
  safeStorage: { isEncryptionAvailable: () => false, encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() },
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
  _setTestWorkspaceRoot(testDir)
  _setTestBootstrapSettingsPath(bootstrapSettingsPath)
  initBackupIpc()
})

afterAll(async () => {
  _setTestWorkspaceRoot(null)
  _setTestBootstrapSettingsPath(null)
  await rm(testDir, { recursive: true, force: true })
})

describe('REQ-005: settings:validate-binary reports honest validity', () => {
  it('returns found:false for a non-existent path without spawning', async () => {
    const res = await invoke('settings:validate-binary', { binaryName: 'ffmpeg', path: join(testDir, 'no-ffmpeg.exe') })
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: false })
  })

  it('returns found:false for a directory without spawning', async () => {
    const dir = join(testDir, 'not-a-binary')
    await mkdir(dir)
    const res = await invoke('settings:validate-binary', { binaryName: 'ffmpeg', path: dir })
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: false })
  })

  it('returns isFile:false when the binary spawns but exits non-zero', async () => {
    const bin = join(testDir, 'fake-ffmpeg.exe')
    await writeFile(bin, '#!/bin/sh\nexit 1', 'utf-8')
    let latest!: FakeProc
    spawnImpl = () => { latest = fakeProc(); return latest }

    const invokePromise = invoke('settings:validate-binary', { binaryName: 'ffmpeg', path: bin })
    latest.emit('close', 1)
    const res = await invokePromise

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: false, isFile: false, version: undefined })
  })

  it('returns isFile:true when the binary spawns and exits zero', async () => {
    const bin = join(testDir, 'real-ffmpeg.exe')
    await writeFile(bin, '#!/bin/sh\nexit 0', 'utf-8')
    let latest!: FakeProc
    spawnImpl = () => { latest = fakeProc(); return latest }

    const invokePromise = invoke('settings:validate-binary', { binaryName: 'ffmpeg', path: bin })
    latest.emitOutput('ffmpeg version 5.0\n'); latest.emit('close', 0)
    const res = await invokePromise

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: true, isFile: true, version: 'ffmpeg version 5.0' })
  })

  it('returns isFile:false when spawn emits an error event', async () => {
    const bin = join(testDir, 'broken-ffmpeg.exe')
    await writeFile(bin, 'not-an-executable', 'utf-8')
    let latest!: FakeProc
    spawnImpl = () => { latest = fakeProc(); return latest }

    const invokePromise = invoke('settings:validate-binary', { binaryName: 'ffmpeg', path: bin })
    latest.emit('error')
    const res = await invokePromise

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ found: false, isFile: false, version: undefined })
  })
})

function fakeProc(): FakeProc {
  const handlers = new Map<string, (code?: number) => void>()
  const stdoutHandlers = new Map<string, (data: Buffer) => void>()
  const stderrHandlers = new Map<string, (data: Buffer) => void>()
  const proc: FakeProc = {
    on: (event, cb) => { handlers.set(event, cb); return proc },
    emit: (event, code) => { handlers.get(event)?.(code) },
    stdout: { on: (event, cb) => stdoutHandlers.set(event, cb) },
    stderr: { on: (event, cb) => stderrHandlers.set(event, cb) },
    emitOutput: (str: string) => {
       const cb = stdoutHandlers.get('data');
       if (cb) cb(Buffer.from(str))
    }
  }
  return proc
}