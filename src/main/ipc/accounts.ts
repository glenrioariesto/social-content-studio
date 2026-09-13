import { safeIpcMain } from './safe-handler'
import { assertSafeId, assertReplizId } from './ipc-handler'
import { readFile, readdir, mkdir, copyFile, stat } from 'fs/promises'
import { join } from 'path'
import { logInfo } from '@main/errors'
import { createAppError, fail, ok } from '@shared/errors'
import { assertInsideWorkspace } from '@main/services/path-guard'
import { getWorkspaceRoot } from '@main/services/workspace-root'
import { atomicWriteJson, mergeKnownFields } from '@main/services/persistence'
import { validateAccount } from '@shared/validators'
import type { Account } from '@shared/index'

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

  safeIpcMain('account:create', async (_event, data: { name?: string; description?: string; replizId?: string }) => {
    const name = typeof data?.name === 'string' ? data.name.trim() : ''
    if (!name) {
      throw createAppError('FS_VALIDATION_ERROR', 'name is required', 'ipc', { channel: 'account:create' })
    }
    if (typeof data?.replizId === 'string' && data.replizId.length > 0) {
      assertReplizId(data.replizId)
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
      ...(typeof data.replizId === 'string' && data.replizId.length > 0
        ? { replizId: data.replizId }
        : {}),
      workflows: [],
      templates: [],
      branding: {}
    }
    await atomicWriteJson(join(confinedDir, 'account.json'), account)
    logInfo(`Account created: ${id}`)
    return ok(account)
  }, 'FS_WRITE_ERROR')

  safeIpcMain('account:update', async (_event, id: string, data: Record<string, unknown>) => {
    const root = ws()
    assertSafeId(id, 'account:update')
    const jsonPath = join(root, 'accounts', id, 'account.json')
    let existing: Account
    try {
      const raw = await readFile(jsonPath, 'utf-8')
      const parsed = validateAccount(JSON.parse(raw))
      if (!parsed.ok) {
        throw createAppError('FS_READ_ERROR', 'Existing account.json is invalid', 'ipc', { id, issues: parsed.issues })
      }
      existing = parsed.value
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err) throw err
      throw createAppError('ACCOUNT_NOT_FOUND', 'Account not found', 'ipc', { id })
    }
    const merged = mergeKnownFields<Account>(existing, data, ['name', 'description', 'replizId', 'workflows', 'templates', 'branding'])
    // Never persist an empty-string description as meaningful; treat as absent.
    if (merged.description === '') delete merged.description
    // Empty-string replizId means "not linked"; treat as absent.
    if (merged.replizId === '') delete merged.replizId
    if (typeof merged.replizId === 'string') {
      assertReplizId(merged.replizId)
    }
    await atomicWriteJson(jsonPath, merged)
    logInfo(`Account updated: ${id}`)
    return ok(merged)
  }, 'FS_WRITE_ERROR')

  safeIpcMain('account:set-logo', async (_event, id: string, sourcePath: string) => {
    const root = ws()
    assertSafeId(id, 'account:set-logo')
    // Validate BEFORE any filesystem work (Spec §4).
    const ext = sourcePath.slice(sourcePath.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_LOGO_EXT.has(ext)) {
      throw createAppError('FS_VALIDATION_ERROR', `Unsupported logo type: ${ext || '(none)'}. Allowed: png, jpg, jpeg, webp, svg`, 'ipc', { id, ext })
    }
    const srcStat = await stat(sourcePath).catch(() => null)
    if (!srcStat || !srcStat.isFile()) {
      throw createAppError('FS_NOT_FOUND', 'Logo file not found', 'ipc', { id, sourcePath })
    }
    if (srcStat.size > MAX_LOGO_BYTES) {
      throw createAppError('FS_VALIDATION_ERROR', 'Logo exceeds the 5 MB limit', 'ipc', { id, size: srcStat.size })
    }

    const accountDir = join(root, 'accounts', id)
    const assetsDir = assertInsideWorkspace(root, join(accountDir, 'assets'), 'account:set-logo').absolute
    const destPath = join(assetsDir, `logo${ext}`)

    // Load existing account or create a new one if it doesn't exist
    const jsonPath = join(accountDir, 'account.json')
    let account: Account
    const raw = await readFile(jsonPath, 'utf-8').catch(() => null)
    if (!raw) {
      // Auto-create account if it doesn't exist
      await mkdir(accountDir, { recursive: true })
      account = {
        id,
        name: id,
        workflows: [],
        templates: [],
        branding: {}
      }
    } else {
      const parsed = validateAccount(JSON.parse(raw))
      if (!parsed.ok) {
        throw createAppError('FS_READ_ERROR', 'Existing account.json is invalid', 'ipc', { id, issues: parsed.issues })
      }
      account = parsed.value
    }

    await mkdir(assetsDir, { recursive: true })
    await copyFile(sourcePath, destPath)
    account.branding = { ...account.branding, logo: `assets/logo${ext}` }
    await atomicWriteJson(jsonPath, account)
    logInfo(`Logo set for ${id}: ${destPath}`)
    return ok(account)
  }, 'FS_WRITE_ERROR')

  safeIpcMain('account:get-logo-url', async (_event, id: string) => {
    const root = ws()
    assertSafeId(id, 'account:get-logo-url')
    try {
      const entries = await readdir(join(root, 'accounts', id, 'assets'))
      const logoFile = entries.find(f => /^logo\.(png|jpe?g|webp|svg)$/i.test(f))
      if (!logoFile) return ok(null)
      const abs = join(root, 'accounts', id, 'assets', logoFile)
      return ok('file://' + abs.replace(/\\/g, '/'))
    } catch {
      return ok(null)
    }
  }, 'FS_READ_ERROR')
}
