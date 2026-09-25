import { expect, test, mock, beforeEach } from 'bun:test'

const mockReadFile = mock(() => Promise.resolve('{"typesafeApiKey": "test-key"}'))
const mockFetch = mock(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ choice: 'codec_unsupported', confidence: 0.9 })
}))

mock.module('fs/promises', () => ({
  readFile: mockReadFile
}))

mock.module('@main/services/workspace-root', () => ({
  BOOTSTRAP_SETTINGS_PATH: 'mock-path'
}))

mock.module('@main/errors', () => ({
  logInfo: mock(),
  logError: mock()
}))

// Test exception: Dynamic import required after mocks setup in Bun tests
const { classifyFfmpegError } = await import('@main/services/typesafe-client')

beforeEach(() => {
  mockReadFile.mockClear()
  mockFetch.mockClear()
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

test('classifyFfmpegError returns choice on success', async () => {
  const result = await classifyFfmpegError('raw error text')
  expect(result).toBe('codec_unsupported')
  expect(mockFetch).toHaveBeenCalled()
})

test('classifyFfmpegError returns null if key missing', async () => {
  mockReadFile.mockImplementationOnce(() => Promise.resolve('{}'))
  const result = await classifyFfmpegError('raw error text')
  expect(result).toBeNull()
  expect(mockFetch).not.toHaveBeenCalled()
})

test('classifyFfmpegError returns null on fetch error', async () => {
  mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network Error')))
  const result = await classifyFfmpegError('raw error text')
  expect(result).toBeNull()
})
