import { expect, test, mock, beforeEach, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { _setTestBootstrapSettingsPath } from '@main/services/workspace-root'

let testDir = ''
let testSettingsFile = ''

const mockFetch = mock(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ choice: 'codec_unsupported', confidence: 0.9 })
}))

mock.module('electron', () => ({
  app: { getPath: () => '' },
  dialog: {},
  BrowserWindow: {}
}))

// Test exception: Dynamic import required after mocks setup in Bun tests
const { classifyFfmpegError, classifyAssetType, checkBrandGuardrails, scoreAssetRelevance, suggestTemplateForContent } = await import('@main/services/typesafe-client')

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'typesafe-test-'))
  testSettingsFile = join(testDir, 'settings.json')
  _setTestBootstrapSettingsPath(testSettingsFile)
})

afterAll(async () => {
  _setTestBootstrapSettingsPath(null)
  await rm(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
  _setTestBootstrapSettingsPath(testSettingsFile)
  mockFetch.mockClear()
  globalThis.fetch = mockFetch as unknown as typeof fetch
  await writeFile(testSettingsFile, JSON.stringify({ typesafeApiKey: 'test-key' }), 'utf-8')
})

test('classifyFfmpegError returns choice on success', async () => {
  mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ choice: 'codec_unsupported', confidence: 0.9 }) }) as unknown as Response)
  const result = await classifyFfmpegError('raw error text')
  expect(result).toBe('codec_unsupported')
})

test('classifyFfmpegError returns null if key missing', async () => {
  await writeFile(testSettingsFile, '{}', 'utf-8')
  const result = await classifyFfmpegError('raw error text')
  expect(result).toBeNull()
})

test('classifyAssetType returns choice on success', async () => {
  mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ choice: 'images', confidence: 0.9 }) }) as unknown as Response)
  const result = await classifyAssetType('photo.png')
  expect(result).toBe('images')
})

test('classifyAssetType returns null if key missing', async () => {
  await writeFile(testSettingsFile, '{}', 'utf-8')
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
  await writeFile(testSettingsFile, '{}', 'utf-8')
  const result = await checkBrandGuardrails('Any text')
  expect(result).toBe(true)
})

test('scoreAssetRelevance returns score on success', async () => {
  mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ score: 85 }) }) as unknown as Response)
  const result = await scoreAssetRelevance({ type: 'html-template' }, 'logo.png')
  expect(result).toBe(85)
})

test('scoreAssetRelevance fails open (returns null) if API key missing', async () => {
  await writeFile(testSettingsFile, '{}', 'utf-8')
  const result = await scoreAssetRelevance({ type: 'html-template' }, 'logo.png')
  expect(result).toBeNull()
})

test('suggestTemplateForContent returns choice on success', async () => {
  mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ choice: 'tmpl-123', confidence: 0.9 }) }) as unknown as Response)
  const templates = [{ id: 'tmpl-123', name: 'News Template', type: 'html-template' }]
  const result = await suggestTemplateForContent('Breaking news caption', templates)
  expect(result).toBe('tmpl-123')
  expect(mockFetch).toHaveBeenCalled()
})

test('suggestTemplateForContent returns null if key missing', async () => {
  await writeFile(testSettingsFile, '{}', 'utf-8')
  const result = await suggestTemplateForContent('caption', [{ id: '1', name: 'A', type: 'B' }])
  expect(result).toBeNull()
})

test('suggestTemplateForContent returns null if no templates available', async () => {
  const result = await suggestTemplateForContent('caption', [])
  expect(result).toBeNull()
})
