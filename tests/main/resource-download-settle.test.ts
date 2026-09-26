import { describe, it, expect, mock } from 'bun:test'
import { _setTestWorkspaceRoot, _setTestBootstrapSettingsPath } from '@main/services/workspace-root'
import { EventEmitter } from 'events'
import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

let wsRoot = ''
const ipcHandlers = new Map<string, (...args: any[]) => Promise<any>>()
let spawnImpl: (cmd: string, args: string[]) => { pid?: number; kill(): void; stderr: EventEmitter } & EventEmitter



mock.module('child_process', () => ({
  spawn: (cmd: string, args: string[]) => spawnImpl(cmd, args)
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

const { initResourceIpc } = await import('../../src/main/ipc/resource')

function fakeProc(): (EventEmitter & { pid?: number; kill(): void; stderr: EventEmitter }) {
  const proc = new EventEmitter() as EventEmitter & { pid?: number; kill(): void; stderr: EventEmitter }
  proc.pid = 1234
  proc.kill = () => {}
  proc.stderr = new EventEmitter()
  return proc
}

function invoke(channel: string, ...args: unknown[]) {
  const fn = ipcHandlers.get(channel)
  if (!fn) throw new Error(`No handler for ${channel}`)
  return fn({} as never, ...args)
}

async function withTmpWs<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'res-'))
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

const timeoutMs = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('SEC-03: resource:download always settles', () => {
  it('resolves (does not hang) when yt-dlp missing (spawn ENOENT path)', async () => {
    await withTmpWs(async () => {
      ipcHandlers.clear()
      initResourceIpc()
      spawnImpl = () => {
        const proc = fakeProc()
        process.nextTick(() => proc.emit('error', new Error('spawn ENOENT')))
        return proc
      }
      const res = await Promise.race([
        invoke('resource:download', 'https://example.com/clip.mp4'),
        timeoutMs(3000).then(() => ({ __timeout: true as const }))
      ])
      expect((res as { __timeout?: true }).__timeout).toBeUndefined()
      expect((res as { success: boolean }).success).toBe(false)
      expect((res as { errorCode?: string }).errorCode).toBe('RESOURCE_DOWNLOAD_FAILED')
    })
  })

  it('rejects a non-http URL before any process is spawned', async () => {
    await withTmpWs(async () => {
      ipcHandlers.clear()
      initResourceIpc()
      let spawned = false
      spawnImpl = () => { spawned = true; return fakeProc() }
      const res = await Promise.race([
        invoke('resource:download', '--skip-download https://example.com'),
        timeoutMs(2000).then(() => ({ __timeout: true as const })),
      ])
      expect(spawned).toBe(false)
      expect((res as { success: boolean }).success).toBe(false)
    })
  })
})