import { safeIpcMain } from './safe-handler'
import { getWorkspaceRoot } from '@main/services/workspace-root'
import {
  getReplizCredentialsStatus,
  saveReplizCredentials,
  verifyReplizAccount,
  attachVerifiedReplizToAccount,
  ReplizError
} from '@main/services/repliz'
import { assertSafeId, assertReplizId } from './ipc-handler'
import { logInfo } from '@main/errors'
import { createAppError, ok } from '@shared/errors'

function toReplizError(err: unknown): never {
  if (err instanceof ReplizError) {
    throw createAppError(err.code, err.message, 'ipc', { channel: 'repliz' })
  }
  throw err
}

export function initReplizIpc(): void {
  safeIpcMain('repliz:get-credentials-status', async () => {
    return ok(await getReplizCredentialsStatus())
  }, 'FS_READ_ERROR')

  safeIpcMain('repliz:save-credentials', async (_event, accessKey: string, secretKey: string) => {
    if (typeof accessKey !== 'string' || accessKey.length === 0 || typeof secretKey !== 'string' || secretKey.length === 0) {
      throw createAppError('FS_VALIDATION_ERROR', 'accessKey and secretKey are required', 'ipc', { channel: 'repliz:save-credentials' })
    }
    const status = await saveReplizCredentials(accessKey, secretKey)
    logInfo('Repliz credentials saved')
    return ok(status)
  }, 'FS_WRITE_ERROR')

  safeIpcMain('repliz:verify-account', async (_event, accountId: string, replizId: string) => {
    assertSafeId(accountId, 'repliz:verify-account')
    assertReplizId(replizId)
    try {
      const result = await verifyReplizAccount(replizId)
      const root = getWorkspaceRoot()
      const account = await attachVerifiedReplizToAccount(root, accountId, result)
      logInfo(`Repliz account verified for ${accountId}`)
      return ok({ account, verified: result })
    } catch (err) {
      toReplizError(err)
    }
  }, 'REPLIZ_NETWORK_ERROR')
}