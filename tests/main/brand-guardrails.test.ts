import { expect, test, mock, beforeAll, afterAll, beforeEach } from 'bun:test'
import { join } from 'path'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'

let wsRoot = ''
const ipcHandlers = new Map<string, (...args: any[]) => Promise<any>>()

mock.module('@main/services/workspace-root', () => ({
  getWorkspaceRoot: () => wsRoot,
  BOOTSTRAP_SETTINGS_PATH: join(wsRoot, 'settings.json')
}))

mock.module('@main/errors', () => ({
  logInfo: mock(),
  logError: mock(),
  logWarning: mock()
}))

mock.module('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: any) => ipcHandlers.set(channel, fn),
    on: () => {}
  },
  dialog: {},
  app: { on: () => {}, getPath: () => '' },
  BrowserWindow: class {}
}))

let mockIsSafe = true
mock.module('@main/services/typesafe-client', () => ({
  checkBrandGuardrails: async () => mockIsSafe,
  classifyAssetType: async () => null,
  classifyFfmpegError: async () => null
}))

// Import dynamically after mocks
const { initRenderIpc } = await import('@main/ipc/render')

beforeAll(async () => {
  wsRoot = await mkdtemp(join(tmpdir(), 'guardrails-test-'))
  await mkdir(join(wsRoot, 'contents', 'test-content'), { recursive: true })
  
  // Write a dummy content file
  const now = new Date().toISOString()
  await writeFile(join(wsRoot, 'contents', 'test-content', 'content.json'), JSON.stringify({
    id: 'test-content',
    title: 'Test title',
    accountId: 'acc-1',
    status: 'draft',
    caption: 'Test caption',
    createdAt: now,
    updatedAt: now
  }), 'utf-8')
})

afterAll(async () => {
  await rm(wsRoot, { recursive: true, force: true })
})

beforeEach(() => {
  ipcHandlers.clear()
  const dummyWindow = { isDestroyed: () => false, webContents: { send: () => {} } } as any
  initRenderIpc(dummyWindow)
  mockIsSafe = true
})

function invoke(channel: string, ...args: unknown[]) {
  const fn = ipcHandlers.get(channel)
  if (!fn) throw new Error(`Channel ${channel} not registered`)
  return fn(undefined, ...args)
}

test('render:start blocks if content violates brand guardrails', async () => {
  mockIsSafe = false // Simulate TypeSafe returning false
  
  const jobData = {
    contentId: 'test-content',
    inputPath: join(wsRoot, 'in.mp4'),
    outputPath: join(wsRoot, 'out.mp4')
  }
  
  const res = await invoke('render:start', jobData)
  
  expect(res.success).toBe(false)
  expect(res.error).toContain('Render blocked: Content contains profanity or violates brand guidelines.')
})

test('render:start allows if content passes brand guardrails', async () => {
  mockIsSafe = true // Simulate TypeSafe returning true
  
  const jobData = {
    contentId: 'test-content',
    inputPath: join(wsRoot, 'in.mp4'),
    outputPath: join(wsRoot, 'out.mp4')
  }
  
  // We expect it to pass the guardrail, but it might fail later because renderEngine is not mocked
  // We just want to ensure it doesn't fail with the guardrail error
  const res = await invoke('render:start', jobData)
  expect(res.error || '').not.toContain('Render blocked')
})
