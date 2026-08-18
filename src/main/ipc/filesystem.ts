import { type BrowserWindow } from 'electron'
import { readFile, writeFile, readdir, mkdir, rm, stat, access } from 'fs/promises'
import { join } from 'path'
import { safeIpcMain } from './safe-handler'
import { logError, logInfo } from '../errors'
import { createAppError, type ErrorCode } from '../../../packages/shared/src/errors'

function getWorkspacePath(): string {
  return join(process.cwd(), 'workspace')
}

function fsError(code: ErrorCode, err: unknown, context?: string) {
  return createAppError(code, err instanceof Error ? err.message : String(err), 'ipc', context)
}

export function initFileSystemIpc(_mainWindow: BrowserWindow): void {
  const ws = getWorkspacePath()

  safeIpcMain('fs:read-file', async (_event, filePath: string) => {
    const content = await readFile(filePath, 'utf-8')
    return { success: true, data: content }
  }, 'FS_READ_ERROR')

  safeIpcMain('fs:write-file', async (_event, filePath: string, content: string) => {
    await writeFile(filePath, content, 'utf-8')
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('fs:readdir', async (_event, dirPath: string) => {
    const entries = await readdir(dirPath, { withFileTypes: true })
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
    await mkdir(dirPath, { recursive: true })
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('fs:rm', async (_event, targetPath: string) => {
    await rm(targetPath, { recursive: true, force: true })
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('fs:exists', async (_event, targetPath: string) => {
    try {
      await access(targetPath)
      return { success: true, data: true }
    } catch {
      return { success: true, data: false }
    }
  }, 'FS_READ_ERROR')

  safeIpcMain('fs:stat', async (_event, targetPath: string) => {
    const s = await stat(targetPath)
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
    const entries = await readdir(join(ws, 'accounts'), { withFileTypes: true })
    const accounts = entries.filter(e => e.isDirectory()).map(e => e.name)
    const results = await Promise.all(
      accounts.map(async (name) => {
        const jsonPath = join(ws, 'accounts', name, 'account.json')
        try {
          const raw = await readFile(jsonPath, 'utf-8')
          return JSON.parse(raw)
        } catch {
          return { id: name, name, workflows: [], templates: [], branding: {} }
        }
      })
    )
    return { success: true, data: results }
  }, 'ACCOUNT_NOT_FOUND')

  safeIpcMain('workspace:get-contents', async (_event, filters?: Record<string, string>) => {
    const contentsDir = join(ws, 'contents')
    const entries = await readdir(contentsDir, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)

    const results = await Promise.all(
      dirs.map(async (dir) => {
        const jsonPath = join(contentsDir, dir, 'content.json')
        try {
          const raw = await readFile(jsonPath, 'utf-8')
          return JSON.parse(raw)
        } catch {
          return null
        }
      })
    )

    let filtered = results.filter(Boolean)
    if (filters) {
      if (filters.accountId) {
        filtered = filtered.filter((c: any) => c.accountId === filters.accountId)
      }
      if (filters.status) {
        filtered = filtered.filter((c: any) => c.status === filters.status)
      }
    }

    return { success: true, data: filtered }
  }, 'CONTENT_NOT_FOUND')

  safeIpcMain('workspace:get-content', async (_event, id: string) => {
    const jsonPath = join(ws, 'contents', id, 'content.json')
    const raw = await readFile(jsonPath, 'utf-8')
    return { success: true, data: JSON.parse(raw) }
  }, 'CONTENT_NOT_FOUND')

  safeIpcMain('workspace:create-content', async (_event, data: Record<string, unknown>) => {
    const contentsDir = join(ws, 'contents')
    const existing = await readdir(contentsDir, { withFileTypes: true })
    const count = existing.filter(e => e.isDirectory()).length
    const id = `content-${String(count + 1).padStart(3, '0')}`
    const contentDir = join(contentsDir, id)
    await mkdir(contentDir, { recursive: true })
    const now = new Date().toISOString()
    const content = {
      id,
      createdAt: now,
      updatedAt: now,
      status: 'idea',
      ...data
    }
    await writeFile(join(contentDir, 'content.json'), JSON.stringify(content, null, 2), 'utf-8')
    logInfo(`Content created: ${id}`)
    return { success: true, data: content }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('workspace:update-content', async (_event, id: string, data: Record<string, unknown>) => {
    const jsonPath = join(ws, 'contents', id, 'content.json')
    const raw = await readFile(jsonPath, 'utf-8')
    const existing = JSON.parse(raw)
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() }
    await writeFile(jsonPath, JSON.stringify(updated, null, 2), 'utf-8')
    return { success: true, data: updated }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('workspace:delete-content', async (_event, id: string) => {
    const contentDir = join(ws, 'contents', id)
    await rm(contentDir, { recursive: true, force: true })
    logInfo(`Content deleted: ${id}`)
    return { success: true }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('workspace:get-templates', async () => {
    const templatesDir = join(ws, 'templates')
    const entries = await readdir(templatesDir, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
    const results = await Promise.all(
      dirs.map(async (dir) => {
        const jsonPath = join(templatesDir, dir, 'template.json')
        try {
          const raw = await readFile(jsonPath, 'utf-8')
          return JSON.parse(raw)
        } catch {
          return { id: dir, name: dir }
        }
      })
    )
    return { success: true, data: results }
  }, 'TEMPLATE_NOT_FOUND')

  safeIpcMain('workspace:get-assets', async (_event, type?: string) => {
    const assetsDir = join(ws, 'assets')
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
