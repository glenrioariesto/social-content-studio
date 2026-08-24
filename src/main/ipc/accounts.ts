import { safeIpcMain } from './safe-handler'
import { readFile, readdir, mkdir, copyFile, stat } from 'fs/promises'
import { join } from 'path'
import { logInfo } from '../errors'
import { createAppError } from '../../../packages/shared/src/errors'
import { assertInsideWorkspace } from '../services/path-guard'
import { getWorkspaceRoot } from '../services/workspace-root'
import { atomicWriteJson, mergeKnownFields } from '../services/persistence'
import { validateAccount } from '../../../packages/shared/src/validators'
import type { Account } from '../../../packages/shared/src/index'

const ALLOWED_LOGO_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg'])
const MAX_LOGO_BYTES = 5 * 1024 * 1024

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'account'
}

/** Generate a unique account id: `<slug>-<4hex>`, re-rolling on collision (max 5). */
async function generateUniqueAccountId(accountsDir: string, name: string): Promise<string> {
  const slug = slugify(name)
  for (let attempt = 0; attempt < 5; attempt++) {
    const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
    const candidate = `${slug}-${hex}`
    try {
      await stat(join(accountsDir, candidate))
    } catch {
      return candidate // does not exist — usable
    }
  }
  throw createAppError('FS_WRITE_ERROR', 'Could not generate a unique account id', 'ipc')
}

export function initAccountsIpc(): void {
  const ws = () => getWorkspaceRoot()

  safeIpcMain('account:create', async (_event, data: { name?: string; description?: string }) => {
    const name = typeof data?.name === 'string' ? data.name.trim() : ''
    if (!name) {
      return { success: false, error: 'name is required', errorCode: 'FS_VALIDATION_ERROR' }
    }
    const root = ws()
    const accountsDir = join(root, 'accounts')
    const id = await generateUniqueAccountId(accountsDir, name)
    const accountDir = join(accountsDir, id)
    const confinedDir = assertInsideWorkspace(root, accountDir, 'account:create').absolute
    await mkdir(confinedDir, { recursive: true })
    const now = new Date().toISOString()
    const account: Account = {
      id,
      name,
      ...(typeof data.description === 'string' && data.description.length > 0
        ? { description: data.description }
        : {}),
      workflows: [],
      templates: [],
      branding: {}
    }
    await atomicWriteJson(join(confinedDir, 'account.json'), account)
    logInfo(`Account created: ${id}`)
    return { success: true, data: account }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('account:update', async (_event, id: string, data: Record<string, unknown>) => {
    const root = ws()
    if (!/^[A-Za-z0-9._-]+$/.test(id) || id.includes('..')) {
      return { success: false, error: `Invalid account id: ${id}`, errorCode: 'FS_PERMISSION_DENIED' }
    }
    const jsonPath = join(root, 'accounts', id, 'account.json')
    let existing: Account
    try {
      const raw = await readFile(jsonPath, 'utf-8')
      const parsed = validateAccount(JSON.parse(raw))
      if (!parsed.ok) {
        return { success: false, error: 'Existing account.json is invalid', errorCode: 'FS_READ_ERROR' }
      }
      existing = parsed.value
    } catch {
      return { success: false, error: 'Account not found', errorCode: 'ACCOUNT_NOT_FOUND' }
    }
    const merged = mergeKnownFields<Account>(existing, data, ['name', 'description'])
    // Never persist an empty-string description as meaningful; treat as absent.
    if (merged.description === '') delete merged.description
    await atomicWriteJson(jsonPath, merged)
    logInfo(`Account updated: ${id}`)
    return { success: true, data: merged }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('account:set-logo', async (_event, id: string, sourcePath: string) => {
    const root = ws()
    if (!/^[A-Za-z0-9._-]+$/.test(id) || id.includes('..')) {
      return { success: false, error: `Invalid account id: ${id}`, errorCode: 'FS_PERMISSION_DENIED' }
    }
    // Validate BEFORE any filesystem work (Spec §4).
    const ext = sourcePath.slice(sourcePath.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_LOGO_EXT.has(ext)) {
      return { success: false, error: `Unsupported logo type: ${ext || '(none)'}. Allowed: png, jpg, jpeg, webp, svg`, errorCode: 'FS_VALIDATION_ERROR' }
    }
    const srcStat = await stat(sourcePath).catch(() => null)
    if (!srcStat || !srcStat.isFile()) {
      return { success: false, error: 'Logo file not found', errorCode: 'FS_NOT_FOUND' }
    }
    if (srcStat.size > MAX_LOGO_BYTES) {
      return { success: false, error: 'Logo exceeds the 5 MB limit', errorCode: 'FS_VALIDATION_ERROR' }
    }

    const accountDir = join(root, 'accounts', id)
    const assetsDir = assertInsideWorkspace(root, join(accountDir, 'assets'), 'account:set-logo').absolute
    const destPath = join(assetsDir, `logo${ext}`)

    // Load existing account first so we can preserve other fields on write.
    const jsonPath = join(accountDir, 'account.json')
    const raw = await readFile(jsonPath, 'utf-8').catch(() => null)
    if (!raw) {
      return { success: false, error: 'Account not found', errorCode: 'ACCOUNT_NOT_FOUND' }
    }
    const parsed = validateAccount(JSON.parse(raw))
    if (!parsed.ok) {
      return { success: false, error: 'Existing account.json is invalid', errorCode: 'FS_READ_ERROR' }
    }
    const account = parsed.value

    await mkdir(assetsDir, { recursive: true })
    await copyFile(sourcePath, destPath)
    account.branding = { ...account.branding, logo: `assets/logo${ext}` }
    await atomicWriteJson(jsonPath, account)
    logInfo(`Logo set for ${id}: ${destPath}`)
    return { success: true, data: account }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('account:get-logo-url', async (_event, id: string) => {
    const root = ws()
    if (!/^[A-Za-z0-9._-]+$/.test(id) || id.includes('..')) {
      return { success: false, error: `Invalid account id: ${id}`, errorCode: 'FS_PERMISSION_DENIED' }
    }
    try {
      const entries = await readdir(join(root, 'accounts', id, 'assets'))
      const logoFile = entries.find(f => /^logo\.(png|jpe?g|webp|svg)$/i.test(f))
      if (!logoFile) return { success: true, data: null }
      const abs = join(root, 'accounts', id, 'assets', logoFile)
      return { success: true, data: 'file://' + abs.replace(/\\/g, '/') }
    } catch {
      return { success: true, data: null }
    }
  }, 'FS_READ_ERROR')

  safeIpcMain('account:list-files', async (_event, id: string) => {
    void id
    return { success: true, data: [] }
  }, 'FS_READ_ERROR')

  safeIpcMain('workspace:get-account', async (_event, id: string) => {
    const root = ws()
    if (!/^[A-Za-z0-9._-]+$/.test(id) || id.includes('..')) {
      return { success: false, error: `Invalid account id: ${id}`, errorCode: 'FS_PERMISSION_DENIED' }
    }
    const raw = await readFile(join(root, 'accounts', id, 'account.json'), 'utf-8').catch(() => null)
    if (!raw) return { success: false, error: 'Account not found', errorCode: 'ACCOUNT_NOT_FOUND' }
    const parsed = validateAccount(JSON.parse(raw))
    if (!parsed.ok) return { success: false, error: 'Invalid account document', errorCode: 'FS_READ_ERROR' }
    return { success: true, data: parsed.value }
  }, 'FS_READ_ERROR')
}
