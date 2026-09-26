import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { join } from 'path'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { createAppError } from '@shared/errors'
import { _setTestWorkspaceRoot } from '@main/services/workspace-root'
import { logError, logInfo, _resetLogInitializedForTest } from '@main/errors'

describe('Main Error Logging', () => {
  let testWs = ''

  beforeAll(async () => {
    testWs = await mkdtemp(join(tmpdir(), 'errors-test-'))
  })

  afterAll(async () => {
    _setTestWorkspaceRoot(null)
    await rm(testWs, { recursive: true, force: true })
  })

  beforeEach(() => {
    _setTestWorkspaceRoot(testWs)
    if (_resetLogInitializedForTest) {
      _resetLogInitializedForTest()
    }
  })

  it('logInfo writes to the correct log file', async () => {
    await logInfo('Test info message')
    const date = new Date().toISOString().split('T')[0]
    const logFile = join(testWs, 'config', 'logs', `${date}.log`)
    const content = await readFile(logFile, 'utf-8')
    expect(content).toContain('[INFO] Test info message')
  })

  it('logError writes error details to the log file', async () => {
    const err = createAppError('FS_READ_ERROR', 'Test error message', 'main', { detail: '123' })
    await logError(err)
    const date = new Date().toISOString().split('T')[0]
    const logFile = join(testWs, 'config', 'logs', `${date}.log`)
    const content = await readFile(logFile, 'utf-8')
    expect(content).toContain('[ERROR]')
    expect(content).toContain('FS_READ_ERROR: Test error message')
    expect(content).toContain('Details: {"detail":"123"}')
  })

  it('logging does not throw if fs operations fail', async () => {
    _setTestWorkspaceRoot('/non-existent-invalid-path-illegal')
    const result = await logInfo('Will fail gracefully')
    expect(result).toBeUndefined()
    _setTestWorkspaceRoot(testWs)
  })
})
