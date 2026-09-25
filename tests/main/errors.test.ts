import { expect, test, mock, beforeEach } from 'bun:test'
import { join } from 'path'
import { createAppError } from '@shared/errors'

const mockAppendFile = mock(() => Promise.resolve())
const mockMkdir = mock(() => Promise.resolve())

mock.module('fs/promises', () => ({
  appendFile: mockAppendFile,
  mkdir: mockMkdir
}))


mock.module('electron', () => ({
  app: {
    on: mock()
  },
  BrowserWindow: {}
}))

mock.module('@main/services/workspace-root', () => ({
  getWorkspaceRoot: () => 'mock-workspace-root'
}))

// Import dynamically after mocks
const { logError, logInfo } = await import('@main/errors')

beforeEach(() => {
  mockAppendFile.mockClear()
  mockMkdir.mockClear()
})

test('logInfo writes to the correct log file', async () => {
  await logInfo('Test info message')
  
  expect(mockMkdir).toHaveBeenCalled()
  expect(mockAppendFile).toHaveBeenCalled()
  
  const callArgs = mockAppendFile.mock.calls[0]
  expect(callArgs[0]).toContain(join('mock-workspace-root', 'config', 'logs'))
  expect(callArgs[1]).toContain('[INFO] Test info message')
})

test('logError writes error details to the log file', async () => {
  const err = createAppError('FS_READ_ERROR', 'Test error message', 'main', { detail: '123' })
  await logError(err)
  
  expect(mockAppendFile).toHaveBeenCalled()
  
  const callArgs = mockAppendFile.mock.calls[0]
  expect(callArgs[0]).toContain(join('mock-workspace-root', 'config', 'logs'))
  expect(callArgs[1]).toContain('[ERROR]')
  expect(callArgs[1]).toContain('FS_READ_ERROR: Test error message')
  expect(callArgs[1]).toContain('Details: {"detail":"123"}')
})

test('logging does not throw if fs operations fail', async () => {
  mockMkdir.mockImplementationOnce(() => Promise.reject(new Error('Disk full')))
  mockAppendFile.mockImplementationOnce(() => Promise.reject(new Error('Disk full')))
  
  // Should resolve silently without throwing
  const result = await logInfo('Will fail gracefully')
  expect(result).toBeUndefined()
})
