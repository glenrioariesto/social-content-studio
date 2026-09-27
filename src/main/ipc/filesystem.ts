import {  classifyAssetType, scoreAssetRelevance, suggestTemplateForContent, testAiConnection , generateContentMetadata } from '@main/services/typesafe-client'
import { shell, type BrowserWindow } from 'electron'
import { readFile, writeFile, readdir, mkdir, rm, stat, access, realpath } from 'fs/promises'
import { join, sep, dirname, relative } from 'path'
import { safeIpcMain } from './safe-handler'
import { assertSafeId } from './ipc-handler'
import { logError, logInfo } from '@main/errors'
import { createAppError, type ErrorCode } from '@shared/errors'
import { assertInsideWorkspace } from '@main/services/path-guard'
import { getWorkspaceRoot } from '@main/services/workspace-root'
import { generateUniqueContentId } from '@main/services/id'
import { atomicWriteJson, mergeKnownFields } from '@main/services/persistence'
import { assertLegalTransition } from '@main/services/lifecycle'
import { validateContent, validateTemplate, validateAccount, type ValidationIssue } from '@shared/validators'
import type { Content, Template, Account } from '@shared/index'
import type { LoadedEntry } from '@shared/loaded-entry'

function fsError(code: ErrorCode, err: unknown, context?: string) {
  return createAppError(code, err instanceof Error ? err.message : String(err), 'ipc', context)
}

/** Reads + validates one document; returns a LoadedEntry (valid or invalid). */
export async function loadEntry<T>(
  jsonPath: string,
  dirName: string,
  validate: (raw: unknown) => { ok: true; value: T } | { ok: false; issues: ValidationIssue[] }
): Promise<LoadedEntry<T>> {
  try {
    const raw = JSON.parse(await readFile(jsonPath, 'utf-8'))
    const result = validate(raw)
    if (result.ok) {
      return { kind: 'valid', id: dirName, data: result.value }
    }
    // SEC-003: log the validation failure (channel, path, issues).
    void logError(createAppError('FS_READ_ERROR', `Invalid document: ${jsonPath}`, 'ipc', { path: jsonPath, issues: result.issues }))
    return { kind: 'invalid', id: dirName, file: jsonPath, issues: result.issues }
  } catch (err) {
    void logError(createAppError('FS_READ_ERROR', `Failed to read/parse ${jsonPath}: ${(err as Error).message}`, 'ipc', { path: jsonPath }))
    return {
      kind: 'invalid',
      id: dirName,
      file: jsonPath,
      issues: [{ field: '$', message: err instanceof Error ? err.message : 'Failed to read/parse' }]
    }
  }
}

/** Lists one document per sub-directory of `root/subdir` (reads `<dir>/<json>` for each). */
export async function loadDirEntries<T>(
  root: string,
  subdir: string,
  jsonFileName: string,
  validate: (raw: unknown) => { ok: true; value: T } | { ok: false; issues: ValidationIssue[] }
): Promise<LoadedEntry<T>[]> {
  const dir = join(root, subdir)
  let names: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    names = entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    names = []
  }
  return Promise.all(names.map(name => loadEntry<T>(join(dir, name, jsonFileName), name, validate)))
}

/** Shared content filters (accountId / status) applied uniformly across consumers. */
export function filterContentEntries(
  results: LoadedEntry<Content>[],
  filters?: Record<string, string>
): LoadedEntry<Content>[] {
  if (!filters) return results
  return results.filter(e => {
    if (e.kind !== 'valid') return false
    if (filters.accountId && e.data.accountId !== filters.accountId) return false
    if (filters.status && e.data.status !== filters.status) return false
    return true
  })
}

/** Secrets that are never readable through the generic `fs:*` bridge. */
function isDeniedSecretPath(root: string, resolved: string): boolean {
  const normResolved = resolved.toLowerCase().replace(/\\/g, '/')
  const normRoot = root.toLowerCase().replace(/\\/g, '/')
  if (normResolved.includes('/config/repliz-credentials') || normResolved.endsWith('.enc.json')) {
    return true
  }
  const rel = relative(root, resolved).toLowerCase().replace(/\\/g, '/')
  return rel.startsWith('config') &&
    (rel.includes('credentials') || rel.endsWith('.enc.json'))
}

/**
 * Guard wrapper: confines a candidate path and logs the refusal (SEC-003) on
 * failure. The backup channels no longer bypass this (the BACKUP_CHANNELS
 * whitelist was removed — SEC-01/PRN-001).
 *
 * `createMode` (fs:write-file / fs:mkdir): the target may not exist yet, so we
 * realpath the parent directory to check for symlink escapes, then operate on
 * the lexical candidate. Read-style ops realpath the full target (SEC-03).
 */
async function guardOrThrow(channel: string, root: string, candidate: string, createMode = false): Promise<string> {
  try {
    const confined = assertInsideWorkspace(root, candidate, channel)
    const absRoot = await realpath(root)

    if (!createMode) {
      // SEC-03: re-check the real (symlink-resolved) path still stays inside root.
      const real = await realpath(confined.absolute)
      if (!real.toLowerCase().startsWith(absRoot.toLowerCase() + sep.toLowerCase()) &&
          real.toLowerCase() !== absRoot.toLowerCase()) {
        throw createAppError('FS_PERMISSION_DENIED', `Symlink escapes workspace root: ${candidate}`, 'ipc', { channel, requested: candidate })
      }
      if (isDeniedSecretPath(absRoot, real) || isDeniedSecretPath(root, real)) {
        throw createAppError('FS_PERMISSION_DENIED', `Access to credential file is restricted: ${candidate}`, 'ipc', { channel, requested: candidate })
      }
      return real
    }

    // Create mode: target may not exist yet. Verify the parent directory is
    // not a symlink escaping the root; a non-existent path has no symlink to
    // exploit, and assertInsideWorkspace already enforced lexical containment.
    try {
      const realParent = await realpath(dirname(confined.absolute))
      if (!realParent.toLowerCase().startsWith(absRoot.toLowerCase() + sep.toLowerCase()) &&
          realParent.toLowerCase() !== absRoot.toLowerCase()) {
        throw createAppError('FS_PERMISSION_DENIED', `Parent symlink escapes workspace root: ${candidate}`, 'ipc', { channel, requested: candidate })
      }
    } catch (parentErr) {
      if (parentErr && typeof parentErr === 'object' && 'code' in parentErr && (parentErr as { code: string }).code !== 'ENOENT') {
        throw parentErr
      }
    }
    if (isDeniedSecretPath(absRoot, confined.absolute) || isDeniedSecretPath(root, confined.absolute)) {
      throw createAppError('FS_PERMISSION_DENIED', `Access to credential file is restricted: ${candidate}`, 'ipc', { channel, requested: candidate })
    }
    return confined.absolute
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'FS_PERMISSION_DENIED') {
      void logError(err as unknown as import('@shared/errors').AppError)
    }
    throw err
  }
}

/**
 * Startup Sweep (Spec AC-012): any content left in `rendering` when the app
 * previously crashed/force-closed is marked `failed` ("interrupted by shutdown").
 * Uses the legal `rendering -> failed` transition (REQ-006). Runs once at init.
 */
async function startupSweep(root: string): Promise<void> {
  try {
    const contentsDir = join(root, 'contents')
    const entries = await readdir(contentsDir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const jsonPath = join(contentsDir, e.name, 'content.json')
      try {
        const raw = await readFile(jsonPath, 'utf-8')
        const parsed = JSON.parse(raw) as Content
        if (parsed && parsed.status === 'rendering') {
          assertLegalTransition('rendering', 'failed') // REQ-006: legal edge
          const updated: Content = { ...parsed, status: 'failed', updatedAt: new Date().toISOString() }
          await atomicWriteJson(jsonPath, updated)
          logInfo(`Startup sweep: marked interrupted render failed for ${parsed.id}`)
        }
      } catch {
        // unreadable content is handled by validation at read time; skip here
      }
    }
  } catch {
    // no contents dir yet — nothing to sweep
  }
}

export function initFileSystemIpc(_mainWindow: BrowserWindow): void {
  const ws = () => getWorkspaceRoot()

  // Startup Sweep: recover content interrupted mid-render before serving reads.
  void startupSweep(ws())

  safeIpcMain('fs:show-in-folder', async (_event, targetPath: string) => {
    const root = ws()
    const finalPath = await guardOrThrow('fs:show-in-folder', root, targetPath)
    shell.showItemInFolder(finalPath)
    return { success: true }
  }, 'FS_READ_ERROR')

  safeIpcMain('fs:read-file', async (_event, filePath: string) => {
    const p = await guardOrThrow('fs:read-file', ws(), filePath)
    const content = await readFile(p, 'utf-8')
    return { success: true, data: content }
  }, 'FS_READ_ERROR')
  safeIpcMain('fs:read-image-base64', async (_event, filePath: string) => {
    const p = await guardOrThrow('fs:read-image-base64', ws(), filePath)
    const statData = await stat(p).catch(() => null)
    if (!statData || !statData.isFile()) {
      throw createAppError('FS_NOT_FOUND', 'Asset not found or is a directory', 'ipc')
    }
    if (statData.size > 5 * 1024 * 1024) {
      throw createAppError('FS_VALIDATION_ERROR', 'Image too large for preview (max 5MB)', 'ipc')
    }
    const data = await readFile(p)
    const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
    const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
    return { success: true, data: `data:${mimeType};base64,${data.toString('base64')}` }
  }, 'FS_READ_ERROR')

  safeIpcMain('fs:write-file', async (_event, filePath: string, content: string) => {
    // createMode: the file may not exist yet (creating new templates/assets).
    const p = await guardOrThrow('fs:write-file', ws(), filePath, true)
    await writeFile(p, content, 'utf-8')
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('fs:readdir', async (_event, dirPath: string) => {
    const p = await guardOrThrow('fs:readdir', ws(), dirPath)
    const entries = await readdir(p, { withFileTypes: true })
    return {
      success: true,
      data: entries.map(e => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        isFile: e.isFile()
      }))
    }
  }, 'FS_READ_ERROR')

  safeIpcMain('fs:mkdir', async (_event, dirPath: string) => {
    // createMode: the directory may not exist yet.
    const p = await guardOrThrow('fs:mkdir', ws(), dirPath, true)
    await mkdir(p, { recursive: true })
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('fs:rm', async (_event, targetPath: string) => {
    const p = await guardOrThrow('fs:rm', ws(), targetPath)
    await rm(p, { recursive: true, force: true })
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('fs:exists', async (_event, targetPath: string) => {
    try {
      const p = await guardOrThrow('fs:exists', ws(), targetPath)
      await access(p)
      return { success: true, data: true }
    } catch {
      return { success: true, data: false }
    }
  }, 'FS_READ_ERROR')

  safeIpcMain('fs:stat', async (_event, targetPath: string) => {
    const p = await guardOrThrow('fs:stat', ws(), targetPath)
    const s = await stat(p)
    return {
      success: true,
      data: {
        isFile: s.isFile(),
        isDirectory: s.isDirectory(),
        size: s.size,
        mtime: s.mtime.toISOString(),
        birthtime: s.birthtime.toISOString()
      }
    }
  }, 'FS_READ_ERROR')

  safeIpcMain('workspace:get-accounts', async () => {
    const root = ws()
    const results = await loadDirEntries<Account>(root, 'accounts', 'account.json', validateAccount)
    return { success: true, data: results }
  }, 'ACCOUNT_NOT_FOUND')

  safeIpcMain('workspace:get-contents', async (_event, filters?: Record<string, string>) => {
    const root = ws()
    const results = await loadDirEntries<Content>(root, 'contents', 'content.json', validateContent)
    return { success: true, data: filterContentEntries(results, filters) }
  }, 'CONTENT_NOT_FOUND')

  safeIpcMain('workspace:get-content', async (_event, id: string) => {
    const root = ws()
    assertSafeId(id, 'workspace:get-content') // SEC-02
    const jsonPath = join(root, 'contents', id, 'content.json')
    const entry = await loadEntry<Content>(jsonPath, id, validateContent)
    return { success: true, data: entry }
  }, 'CONTENT_NOT_FOUND')

  safeIpcMain('workspace:create-content', async (_event, data: Record<string, unknown>) => {
    const root = ws()
    const contentsDir = join(root, 'contents')
    const id = generateUniqueContentId(contentsDir)
    const contentDir = join(contentsDir, id)
    await mkdir(contentDir, { recursive: true })
    const now = new Date().toISOString()
    const content: Content = {
      id,
      createdAt: now,
      updatedAt: now,
      status: 'idea',
      accountId: typeof data.accountId === 'string' ? data.accountId : '',
      title: typeof data.title === 'string' ? data.title : '',
      ...(typeof data.description === 'string' ? { description: data.description } : {}),
      ...(typeof data.templateId === 'string' ? { templateId: data.templateId } : {})
    } as Content
    await atomicWriteJson(join(contentDir, 'content.json'), content)
    logInfo(`Content created: ${id}`)
    return { success: true, data: content }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('workspace:update-content', async (_event, id: string, data: Record<string, unknown>) => {
    const root = ws()
    assertSafeId(id, 'workspace:update-content') // SEC-02
    const jsonPath = join(root, 'contents', id, 'content.json')
    const raw = await readFile(jsonPath, 'utf-8')
    const existing = JSON.parse(raw) as Content
    const merged = mergeKnownFields<Content>(existing, data, [
      'title', 'description', 'status', 'templateId', 'resourcePath',
      'compositionHtml', 'output', 'caption', 'hashtags', 'scheduledAt'
    ])
    // REQ-006: all status mutations MUST pass through the transition guard.
    if (typeof data.status === 'string' && data.status !== existing.status) {
      assertLegalTransition(existing.status, merged.status)
    }
    merged.updatedAt = new Date().toISOString()
    await atomicWriteJson(jsonPath, merged)
    return { success: true, data: merged }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('workspace:delete-content', async (_event, id: string) => {
    const root = ws()
    assertSafeId(id, 'workspace:delete-content') // SEC-02
    const contentDir = join(root, 'contents', id)
    const confined = await guardOrThrow('workspace:delete-content', root, contentDir) // SEC-02: confined
    await rm(confined, { recursive: true, force: true })
    logInfo(`Content deleted: ${id}`)
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('workspace:get-templates', async () => {
    const root = ws()
    const results = await loadDirEntries<Template>(root, 'templates', 'template.json', validateTemplate)
    return { success: true, data: results }
  }, 'TEMPLATE_NOT_FOUND')

  safeIpcMain('workspace:get-assets', async (_event, type?: string) => {
    const root = ws()
    const assetsDir = join(root, 'assets')
    const subdirs = type ? [type] : ['images', 'audio', 'video', 'fonts']
    const results: Record<string, string[]> = {}
    for (const sub of subdirs) {
      try {
        const entries = await readdir(join(assetsDir, sub), { withFileTypes: true })
        results[sub] = entries.filter(e => e.isFile()).map(e => e.name)
      } catch {
        results[sub] = []
      }
    }
    return { success: true, data: results }
  }, 'FS_READ_ERROR')

  safeIpcMain('ai:classify-asset', async (_event, filename: string) => {
    const category = await classifyAssetType(filename)
    return { success: true, data: category }
  }, 'FS_READ_ERROR')

  safeIpcMain('ai:score-asset', async (_event, templateMetadata: Record<string, unknown>, assetName: string) => {
    const score = await scoreAssetRelevance(templateMetadata, assetName)
    return { success: true, data: score }
  }, 'FS_READ_ERROR')

  safeIpcMain('ai:test-connection', async () => {
    const result = await testAiConnection()
    if (!result) throw createAppError('FS_READ_ERROR', 'AI connection test failed', 'ipc')
    return { success: true, data: result }
  }, 'FS_READ_ERROR')

  safeIpcMain('ai:suggest-template', async (_event, contentSnippet: string, availableTemplates: { id: string; name: string; type: string }[]) => {
    const templateId = await suggestTemplateForContent(contentSnippet, availableTemplates)
    return { success: true, data: templateId }
  }, 'FS_READ_ERROR')
}
