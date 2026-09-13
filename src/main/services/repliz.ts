import { readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { safeStorage } from 'electron'
import { createAppError } from '@shared/errors'
import type { ErrorCode } from '@shared/errors'
import type { ReplizAccountVerifyResult, ReplizCredentialsStatus, Account } from '@shared/index'
import { validateAccount } from '@shared/validators'
import { atomicWriteJson } from './persistence'
import { logInfo } from '@main/errors'

const CRED_FILE = join(process.cwd(), 'workspace', 'config', 'repliz-credentials.enc.json')

interface StoredReplizCredentials {
  accessKey: string
  secretKey: string
}

interface StoredReplizCredentialsEnvelope {
  version: 1
  encrypted: boolean
  payload: string
}

export class ReplizError extends Error {
  code: ErrorCode
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

function maskKey(key: string): string {
  if (key.length <= 4) return '****'
  return key.slice(0, 2) + '****' + key.slice(-2)
}

/** Bundles credentials from the encrypted vault without exposing them to renderer. */
async function readCredentials(): Promise<StoredReplizCredentials | null> {
  try {
    const raw = await readFile(CRED_FILE, 'utf-8')
    const env = JSON.parse(raw) as StoredReplizCredentialsEnvelope
    if (env.version !== 1) return null
    if (env.encrypted) {
      if (!safeStorage.isEncryptionAvailable()) return null
      const dec = safeStorage.decryptString(Buffer.from(env.payload, 'base64'))
      return JSON.parse(dec) as StoredReplizCredentials
    }
    return JSON.parse(Buffer.from(env.payload, 'base64').toString('utf-8')) as StoredReplizCredentials
  } catch {
    return null
  }
}

export async function saveReplizCredentials(accessKey: string, secretKey: string): Promise<ReplizCredentialsStatus> {
  await mkdir(join(process.cwd(), 'workspace', 'config'), { recursive: true })
  const credentials: StoredReplizCredentials = { accessKey, secretKey }
  const payload = Buffer.from(JSON.stringify(credentials), 'utf-8')
  let encrypted = false
  let payloadB64: string
  if (safeStorage.isEncryptionAvailable()) {
    payloadB64 = safeStorage.encryptString(JSON.stringify(credentials)).toString('base64')
    encrypted = true
  } else {
    payloadB64 = payload.toString('base64')
  }
  const envelope: StoredReplizCredentialsEnvelope = { version: 1, encrypted, payload: payloadB64 }
  await atomicWriteJson(CRED_FILE, envelope)
  logInfo(`Repliz credentials saved (encrypted=${encrypted})`)
  return { configured: true, encrypted, accessKeyMasked: maskKey(accessKey) }
}

export async function getReplizCredentialsStatus(): Promise<ReplizCredentialsStatus> {
  const credentials = await readCredentials()
  if (credentials && credentials.accessKey) {
    return { configured: true, encrypted: true, accessKeyMasked: maskKey(credentials.accessKey) }
  }
  return { configured: false, encrypted: safeStorage.isEncryptionAvailable() }
}

/**
 * The user is on Standard+ tier (Account API). Verify a single account via
 * GET /public/account/{accountId} with Basic Auth. Credentials never cross
 * to the renderer; only the sanitized result does.
 */
export async function verifyReplizAccount(replizId: string): Promise<ReplizAccountVerifyResult> {
  const credentials = await readCredentials()
  if (!credentials || !credentials.accessKey || !credentials.secretKey) {
    throw new ReplizError('REPLIZ_NOT_CONFIGURED', 'Repliz credentials are not configured')
  }

  const basic = Buffer.from(`${credentials.accessKey}:${credentials.secretKey}`, 'utf-8').toString('base64')

  let response: Response
  try {
    response = await fetch(`https://api.repliz.com/public/account/${encodeURIComponent(replizId)}`, {
      headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    })
  } catch (err) {
    if ((err as Error).name === 'TimeoutError') {
      throw new ReplizError('REPLIZ_NETWORK_ERROR', 'Repliz request timed out')
    }
    throw new ReplizError('REPLIZ_NETWORK_ERROR', (err as Error).message)
  }

  if (response.status === 401) throw new ReplizError('REPLIZ_UNAUTHORIZED', 'Repliz authentication failed')
  if (response.status === 404) throw new ReplizError('REPLIZ_ACCOUNT_NOT_FOUND', `Repliz account not found: ${replizId}`)
  if (response.status === 429) throw new ReplizError('REPLIZ_RATE_LIMITED', 'Repliz rate limit reached')
  if (!response.ok) throw new ReplizError('REPLIZ_NETWORK_ERROR', `Repliz request failed (${response.status})`)

  const data = (await response.json()) as Record<string, unknown>
  const payload = data.data && typeof data.data === 'object' ? data.data as Record<string, unknown> : data

  const name = typeof payload.name === 'string' ? payload.name : replizId
  const type = typeof payload.type === 'string' ? payload.type : 'unknown'
  const username = typeof payload.username === 'string' ? payload.username : ''
  const isConnected = typeof payload.isConnected === 'boolean' ? payload.isConnected : true

  return {
    replizId,
    name,
    username,
    type,
    isConnected,
    verifiedAt: new Date().toISOString()
  }
}

/** Rewrites an account.json with verified repliz link metadata (atomic). */
export async function attachVerifiedReplizToAccount(root: string, localAccountId: string, result: ReplizAccountVerifyResult): Promise<Account> {
  const jsonPath = join(root, 'accounts', localAccountId, 'account.json')
  const raw = await readFile(jsonPath, 'utf-8')
  const parsed = validateAccount(JSON.parse(raw))
  if (!parsed.ok) throw createAppError('FS_READ_ERROR', 'Existing account.json is invalid', 'ipc', { id: localAccountId })
  const account = parsed.value
  account.replizId = result.replizId
  account.replizPlatform = result.type
  account.replizConnected = result.isConnected
  account.replizVerifiedAt = result.verifiedAt
  await atomicWriteJson(jsonPath, account)
  return account
}