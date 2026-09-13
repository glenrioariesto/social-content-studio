import { safeIpcMain } from './safe-handler'
import { mkdir, writeFile, readdir, readFile, unlink, copyFile } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { logInfo, logError } from '@main/errors'
import { createAppError, type IPCResult } from '@shared/errors'
import { getWorkspaceRoot } from '@main/services/workspace-root'
import { assertInsideWorkspace } from '@main/services/path-guard'
import { sanitizeFileName, parseResourceMeta } from '@main/services/resource-utils'
import type { Resource } from '@shared/resource'

/** Absolute resources directory, guaranteed to live inside the workspace root. */
function resourcesDir(): string {
  const root = getWorkspaceRoot()
  return assertInsideWorkspace(root, join(root, 'resources'), 'resource').absolute
}

async function readMetas(): Promise<Resource[]> {
  const dir = resourcesDir()
  let files: string[] = []
  try {
    files = await readdir(dir)
  } catch {
    return []
  }
  const metas: Resource[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await readFile(join(dir, file), 'utf-8')
      const meta = parseResourceMeta(raw)
      if (meta) {
        metas.push(meta)
      } else {
        logError(createAppError('FS_READ_ERROR', `resource:list skipped invalid meta ${file}`, 'ipc'))
      }
    } catch (err) {
      logError(createAppError('FS_READ_ERROR', `resource:list failed to parse ${file}: ${err}`, 'ipc'))
    }
  }
  return metas
}

export function initResourceIpc(): void {
  safeIpcMain('resource:list', async () => {
    const metas = await readMetas()
    return { success: true, data: metas }
  }, 'FS_READ_ERROR')

  safeIpcMain('resource:download', async (_event, url: string, fileName?: string) => {
    if (typeof url !== 'string' || url.trim() === '') {
      throw new Error('resource:download requires a non-empty url')
    }
    const dir = resourcesDir()
    await mkdir(dir, { recursive: true })
    const name = sanitizeFileName(fileName ?? '', `resource-${Date.now()}.mp4`)
    const outputPath = join(dir, name)

    logInfo(`resource:download start url=${url} output=${outputPath}`)

    return await new Promise<IPCResult<Resource>>((resolve) => {
      let stderr = ''
      const proc = spawn('yt-dlp', ['-f', 'best', '-o', outputPath, url], { stdio: 'pipe' })
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
      proc.on('close', async (code) => {
        if (code !== 0) {
          const message = stderr.trim() || `yt-dlp exited with code ${code}`
          logError(createAppError('RESOURCE_DOWNLOAD_FAILED', `resource:download failed: ${message}`, 'ipc'))
          resolve({ success: false, error: message, errorCode: 'RESOURCE_DOWNLOAD_FAILED' })
          return
        }
        const meta: Resource = {
          id: name,
          source: 'internet',
          sourceUrl: url,
          fileName: name,
          filePath: outputPath,
          status: 'ready',
          createdAt: new Date().toISOString()
        }
        try {
          await writeFile(join(dir, `${name}.json`), JSON.stringify(meta, null, 2), 'utf-8')
          resolve({ success: true, data: meta })
        } catch (err) {
          logError(createAppError('FS_WRITE_ERROR', `resource:download meta write failed: ${err}`, 'ipc'))
          resolve({ success: false, error: 'Downloaded but failed to record metadata', errorCode: 'FS_WRITE_ERROR' })
        }
      })
    })
  }, 'FS_WRITE_ERROR')

  safeIpcMain('resource:upload', async (_event, sourcePath: string, fileName: string) => {
    if (typeof sourcePath !== 'string' || typeof fileName !== 'string' || !sourcePath || !fileName) {
      throw new Error('resource:upload requires sourcePath and fileName')
    }
    const dir = resourcesDir()
    await mkdir(dir, { recursive: true })
    const name = sanitizeFileName(fileName, `resource-${Date.now()}`)
    const outputPath = join(dir, name)
    await copyFile(sourcePath, outputPath)
    const meta: Resource = {
      id: name,
      source: 'upload',
      fileName: name,
      filePath: outputPath,
      status: 'ready',
      createdAt: new Date().toISOString()
    }
    await writeFile(join(dir, `${name}.json`), JSON.stringify(meta, null, 2), 'utf-8')
    return { success: true, data: meta }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('resource:delete', async (_event, id: string) => {
    if (typeof id !== 'string' || !id) {
      throw new Error('resource:delete requires a resource id')
    }
    const dir = resourcesDir()
    const name = sanitizeFileName(id, id)
    const jsonPath = join(dir, `${name}.json`)
    let meta: Resource | null = null
    try {
      meta = JSON.parse(await readFile(jsonPath, 'utf-8')) as Resource
    } catch {
      meta = null
    }
    try {
      await unlink(jsonPath).catch(() => {})
      if (meta && meta.filePath) {
        const target = assertInsideWorkspace(getWorkspaceRoot(), meta.filePath, 'resource').absolute
        await unlink(target).catch(() => {})
      }
      return { success: true, data: null }
    } catch (err) {
      logError(createAppError('FS_READ_ERROR', `resource:delete failed for ${name}: ${err}`, 'ipc'))
      return { success: false, error: 'resource:delete failed', errorCode: 'FS_READ_ERROR' }
    }
  }, 'FS_READ_ERROR')
}