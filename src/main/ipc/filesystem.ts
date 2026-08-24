import { type BrowserWindow } from 'electron'
import { readFile, writeFile, readdir, mkdir, rm, stat, access } from 'fs/promises'
import { readFileSync } from 'fs'
import { join } from 'path'
import { safeIpcMain } from './safe-handler'
import { logError, logInfo } from '../errors'
import { createAppError, type ErrorCode } from '../../../packages/shared/src/errors'
import { assertInsideWorkspace } from '../services/path-guard'
import { generateUniqueContentId } from '../services/id'
import { atomicWriteJson, mergeKnownFields } from '../services/persistence'
import { validateContent, validateTemplate, validateAccount, type ValidationIssue } from '../../../packages/shared/src/validators'
import type { Content, Template, Account } from '../../../packages/shared/src/index'
import type { LoadedEntry } from '../../../packages/shared/src/loaded-entry'

const SETTINGS_PATH = join(process.cwd(), 'workspace', 'config', 'settings.json')

/**
 * Single source of truth for the Workspace Root (Spec REQ-004 / CON-002).
 * Persisted `workspacePath` in config/settings.json wins; falls back to the
 * legacy cwd/workspace when unset. Missing/invalid settings is tolerated here
 * (the startup sweep routes to guided setup) — this just resolves the path.
 */
function getWorkspaceRoot(): string {
  try {
    const raw = require('fs').readFileSync(SETTINGS_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as { workspacePath?: string }
    if (parsed && typeof parsed.workspacePath === 'string' && parsed.workspacePath.length > 0) {
      return parsed.workspacePath
    }
  } catch {
    // no settings yet — fall through to default
  }
  return join(process.cwd(), 'workspace')
}

function fsError(code: ErrorCode, err: unknown, context?: string) {
  return createAppError(code, err instanceof Error ? err.message : String(err), 'ipc', context)
}

/** Reads + validates one document; returns a LoadedEntry (valid or invalid). */
function loadEntry<T>(
  jsonPath: string,
  dirName: string,
  validate: (raw: unknown) => { ok: true; value: T } | { ok: false; issues: ValidationIssue[] }
): LoadedEntry<T> {
  try {
    const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'))
    const result = validate(raw)
    if (result.ok) {
      return { kind: 'valid', id: dirName, data: result.value }
    }
    return { kind: 'invalid', id: dirName, file: jsonPath, issues: result.issues }
  } catch (err) {
    return {
      kind: 'invalid',
      id: dirName,
      file: jsonPath,
      issues: [{ field: '$', message: err instanceof Error ? err.message : 'Failed to read/parse' }]
    }
  }
}

// Synchronous read used by loadEntry (documents are small JSON on local disk).

function logRefusal(channel: string, requested: string): void {
  const err = createAppError('FS_PERMISSION_DENIED', `Refused out-of-workspace access: ${requested}`, 'ipc', { channel, requested })
  void logError(err)
}

const BACKUP_CHANNELS = new Set(['backup:export', 'backup:import'])

function guardOrThrow(channel: string, root: string, candidate: string): string {
  // Backup export/import are the sole whitelist exception (ADR-0001): they
  // originate from an explicit user dialog and are logged elsewhere.
  if (BACKUP_CHANNELS.has(channel)) return candidate
  const confined = assertInsideWorkspace(root, candidate, channel)
  return confined.absolute
}

/**
 * Startup Sweep (Spec AC-012): any content left in `rendering` when the app
 * previously crashed/force-closed is marked `failed` with reason "interrupted
 * by shutdown". This uses the legal `rendering -> failed` transition and leaves
 * the item retryable through the existing `failed -> rendering` flow. Runs once
 * at IPC initialization.
 */
async function startupSweep(root: string): Promise<void> {
  try {
    const contentsDir = join(root, 'contents')
    const entries = await readdir(contentsDir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const jsonPath = join(contentsDir, e.name, 'content.json')
      try {
        const raw = readFileSync(jsonPath, 'utf-8')
        const parsed = JSON.parse(raw) as Content
        if (parsed && parsed.status === 'rendering') {
          const updated: Content = {
            ...parsed,
            status: 'failed',
            updatedAt: new Date().toISOString()
          }
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

  safeIpcMain('fs:read-file', async (_event, filePath: string) => {
    const p = guardOrThrow('fs:read-file', ws(), filePath)
    const content = await readFile(p, 'utf-8')
    return { success: true, data: content }
  }, 'FS_READ_ERROR')

  safeIpcMain('fs:write-file', async (_event, filePath: string, content: string) => {
    const p = guardOrThrow('fs:write-file', ws(), filePath)
    await writeFile(p, content, 'utf-8')
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('fs:readdir', async (_event, dirPath: string) => {
    const p = guardOrThrow('fs:readdir', ws(), dirPath)
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
    const p = guardOrThrow('fs:mkdir', ws(), dirPath)
    await mkdir(p, { recursive: true })
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('fs:rm', async (_event, targetPath: string) => {
    const p = guardOrThrow('fs:rm', ws(), targetPath)
    await rm(p, { recursive: true, force: true })
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('fs:exists', async (_event, targetPath: string) => {
    try {
      guardOrThrow('fs:exists', ws(), targetPath)
      await access(targetPath)
      return { success: true, data: true }
    } catch {
      return { success: true, data: false }
    }
  }, 'FS_READ_ERROR')

  safeIpcMain('fs:stat', async (_event, targetPath: string) => {
    const p = guardOrThrow('fs:stat', ws(), targetPath)
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
    const entries = await readdir(join(root, 'accounts'), { withFileTypes: true })
    const accounts = entries.filter(e => e.isDirectory()).map(e => e.name)
    const results: LoadedEntry<Account>[] = accounts.map(name => {
      const jsonPath = join(root, 'accounts', name, 'account.json')
      return loadEntry<Account>(jsonPath, name, validateAccount)
    })
    return { success: true, data: results }
  }, 'ACCOUNT_NOT_FOUND')

  safeIpcMain('workspace:get-contents', async (_event, filters?: Record<string, string>) => {
    const root = ws()
    const contentsDir = join(root, 'contents')
    const entries = await readdir(contentsDir, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)

    const results: LoadedEntry<Content>[] = dirs.map(dir => {
      const jsonPath = join(contentsDir, dir, 'content.json')
      return loadEntry<Content>(jsonPath, dir, validateContent)
    })

    if (filters) {
      return {
        success: true,
        data: results.filter(e => {
          if (e.kind !== 'valid') return false
          if (filters.accountId && e.data.accountId !== filters.accountId) return false
          if (filters.status && e.data.status !== filters.status) return false
          return true
        })
      }
    }
    return { success: true, data: results }
  }, 'CONTENT_NOT_FOUND')

  safeIpcMain('workspace:get-content', async (_event, id: string) => {
    const root = ws()
    const jsonPath = join(root, 'contents', id, 'content.json')
    const entry = loadEntry<Content>(jsonPath, id, validateContent)
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
    const jsonPath = join(root, 'contents', id, 'content.json')
    const raw = await readFile(jsonPath, 'utf-8')
    const existing = JSON.parse(raw) as Content
    const merged = mergeKnownFields<Content>(existing, data, [
      'title', 'description', 'status', 'templateId', 'resourcePath',
      'compositionHtml', 'output', 'caption', 'hashtags', 'scheduledAt'
    ])
    merged.updatedAt = new Date().toISOString()
    await atomicWriteJson(jsonPath, merged)
    return { success: true, data: merged }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('workspace:delete-content', async (_event, id: string) => {
    const root = ws()
    const contentDir = join(root, 'contents', id)
    await rm(contentDir, { recursive: true, force: true })
    logInfo(`Content deleted: ${id}`)
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('workspace:get-templates', async () => {
    const root = ws()
    const entries = await readdir(join(root, 'templates'), { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
    const results: LoadedEntry<Template>[] = dirs.map(dir => {
      const jsonPath = join(root, 'templates', dir, 'template.json')
      return loadEntry<Template>(jsonPath, dir, validateTemplate)
    })
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
}
