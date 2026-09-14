import { describe, it, expect, mock } from 'bun:test'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

let wsRoot = ''

mock.module('C:/project/social-content-studio/src/main/errors.ts', () => ({
  logInfo: () => {},
  logError: () => {},
  logWarning: () => {}
}))

mock.module('C:/project/social-content-studio/src/main/services/workspace-root.ts', () => ({
  getWorkspaceRoot: () => wsRoot
}))

mock.module('electron', () => ({
  safeStorage: { isEncryptionAvailable: () => false },
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
  app: { on: () => {}, getPath: () => '' },
  BrowserWindow: class {}
}))

const { saveReplizCredentials, getReplizCredentialsStatus } = await import('../../src/main/services/repliz')

async function withTmpWs<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'repliz-'))
  wsRoot = root
  try {
    return await fn(root)
  } finally {
    wsRoot = ''
    await rm(root, { recursive: true, force: true })
  }
}

describe('SEC-04: repliz credentials honesty when safeStorage is unavailable', () => {
  it('reports encrypted:false (never claims encryption for base64 fallback)', async () => {
    await withTmpWs(async (root) => {
      const status = await saveReplizCredentials('AKIAEXAMPLE123', 'sk-super-secret')
      expect(status.encrypted).toBe(false)
      expect(status.configured).toBe(true)
      // The persisted envelope must carry the honest flag, not a false claim.
      const envelope = JSON.parse(await readFile(join(root, 'config', 'repliz-credentials.enc.json'), 'utf-8'))
      expect(envelope.encrypted).toBe(false)
      const payload = Buffer.from(envelope.payload, 'base64').toString('utf-8')
      expect(payload).toBe(JSON.stringify({ accessKey: 'AKIAEXAMPLE123', secretKey: 'sk-super-secret' }))
    })
  })

  it('getReplizCredentialsStatus surfaces the honest encrypted flag', async () => {
    await withTmpWs(async (root) => {
      await saveReplizCredentials('AKIAEXAMPLE123', 'sk-super-secret')
      const status = await getReplizCredentialsStatus()
      expect(status.encrypted).toBe(false)
      expect(status.accessKeyMasked).toBe('AK****23')
    })
  })
})