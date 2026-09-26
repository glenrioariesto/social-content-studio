import { expect, test, mock, beforeEach } from 'bun:test'

const mockReadFile = mock(() => Promise.resolve('{"typesafeApiKey": "test-key"}'))
const mockFetch = mock(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ choice: 'codec_unsupported', confidence: 0.9 })
}))

mock.module('electron', () => ({
  app: { getPath: () => '' },
  dialog: {},
  BrowserWindow: {}
}))

mock.module('fs/promises', () => ({
  readFile: mockReadFile
}))

mock.module('@main/services/workspace-root', () => ({
  BOOTSTRAP_SETTINGS_PATH: 'mock-path'
}))

mock.module('@main/errors', () => ({
  logInfo: mock(),
  logError: mock(),
  logWarning: mock()
}))

// Test exception: Dynamic import required after mocks setup in Bun tests
const { classifyFfmpegError, classifyAssetType, checkBrandGuardrails, scoreAssetRelevance } = await import('@main/services/typesafe-client')

beforeEach(() => {
  mockReadFile.mockClear()
  mockFetch.mockClear()
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

test('classifyFfmpegError returns choice on success', async () => {
  mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ choice: 'codec_unsupported', confidence: 0.9 }) }) as unknown as Response)
  const result = await classifyFfmpegError('raw error text')
  expect(result).toBe('codec_unsupported')
})

test('classifyFfmpegError returns null if key missing', async () => {
  mockReadFile.mockImplementationOnce(() => Promise.resolve('{}'))
  const result = await classifyFfmpegError('raw error text')
  expect(result).toBeNull()
})

test('classifyAssetType returns choice on success', async () => {
  mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ choice: 'images', confidence: 0.9 }) }) as unknown as Response)
  const result = await classifyAssetType('photo.png')
  expect(result).toBe('images')
})

test('classifyAssetType returns null if key missing', async () => {
  mockReadFile.mockImplementationOnce(() => Promise.resolve('{}'))
  const result = await classifyAssetType('photo.png')
  expect(result).toBeNull()
})

test('checkBrandGuardrails returns true if noul > 0.6', async () => {
  mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ noul: 0.8 }) }) as unknown as Response)
  const result = await checkBrandGuardrails('A very professional text.')
  expect(result).toBe(true)
})

test('checkBrandGuardrails returns false if noul <= 0.6', async () => {
  mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ noul: 0.4 }) }) as unknown as Response)
  const result = await checkBrandGuardrails('Some aggressive text.')
  expect(result).toBe(false)
})

test('checkBrandGuardrails fails open (returns true) if API key missing', async () => {
  mockReadFile.mockImplementationOnce(() => Promise.resolve('{}'))
  const result = await checkBrandGuardrails('Any text')
  expect(result).toBe(true)
})

test('scoreAssetRelevance returns score on success', async () => {
  mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ score: 85 }) }) as unknown as Response)
  const result = await scoreAssetRelevance({ type: 'html-template' }, 'logo.png')
  expect(result).toBe(85)
})

test('scoreAssetRelevance fails open (returns null) if API key missing', async () => {
  mockReadFile.mockImplementationOnce(() => Promise.resolve('{}'))
  const result = await scoreAssetRelevance({ type: 'html-template' }, 'logo.png')
  expect(result).toBeNull()
})
