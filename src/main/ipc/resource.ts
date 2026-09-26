import { safeIpcMain } from './safe-handler'
import { pickSourceFile } from './native-picker'
import { mkdir, writeFile, readdir, readFile, unlink, copyFile } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { logInfo, logError } from '@main/errors'
import { createAppError, type IPCResult } from '@shared/errors'
import { resolveBinary } from '@main/services/binary-resolver'
import { getWorkspaceRoot } from '@main/services/workspace-root'
import { assertInsideWorkspace } from '@main/services/path-guard'
import { sanitizeFileName, parseResourceMeta, isAllowedDownloadUrl } from '@main/services/resource-utils'
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
    const trimmedUrl = url.trim()
    if (!isAllowedDownloadUrl(trimmedUrl)) {
      throw createAppError('RESOURCE_INVALID_URL', 'Only http(s) URLs are allowed', 'ipc', { url: trimmedUrl })
    }
    const dir = resourcesDir()
    await mkdir(dir, { recursive: true })
    const name = sanitizeFileName(fileName ?? '', `resource-${Date.now()}.mp4`)
    const outputPath = join(dir, name)

    logInfo(`resource:download start url=${trimmedUrl} output=${outputPath}`)
    const ytDlpBin = await resolveBinary('yt-dlp')
    const ffmpegBin = await resolveBinary('ffmpeg')
    const { promise, resolve } = Promise.withResolvers<IPCResult<Resource>>()
    
    let stderr = ''
    let proc;
    try {
      proc = spawn(ytDlpBin, ['-f', 'best', '--ffmpeg-location', ffmpegBin, '-o', outputPath, trimmedUrl], { stdio: 'pipe' })
    } catch (err) {
      const message = `Synchronous spawn failed for ${ytDlpBin}. Error: ${(err as Error).message}`
      logError(createAppError('RESOURCE_DOWNLOAD_FAILED', message, 'ipc'))
      resolve({ success: false, error: message, errorCode: 'RESOURCE_DOWNLOAD_FAILED' })
      return promise
    }
    const timer = setTimeout(() => {
      proc.kill()
      const message = 'yt-dlp download timed out'
      logError(createAppError('RESOURCE_DOWNLOAD_FAILED', `resource:download failed: ${message}`, 'ipc'))
      resolve({ success: false, error: message, errorCode: 'RESOURCE_DOWNLOAD_FAILED' })
    }, 10 * 60 * 1000)
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('error', (err) => {
      clearTimeout(timer)
      const message = `yt-dlp failed to start: ${err.message}`
      logError(createAppError('RESOURCE_DOWNLOAD_FAILED', `resource:download failed: ${message}`, 'ipc'))
      resolve({ success: false, error: message, errorCode: 'RESOURCE_DOWNLOAD_FAILED' })
    })
    proc.on('close', async (code) => {
      clearTimeout(timer)
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
    return promise
  }, 'FS_WRITE_ERROR')

  safeIpcMain('resource:upload', async (_event, fileName?: string) => {
    const dir = resourcesDir()
    const sourcePath = await pickSourceFile([{ name: 'Media', extensions: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'jpg', 'jpeg', 'png', 'gif', 'webp'] }])
    if (!sourcePath) {
      return { success: false, error: 'No file selected' }
    }
    await mkdir(dir, { recursive: true })
    const sourceName = typeof fileName === 'string' && fileName.trim() ? fileName : sourcePath.split(/[\\/]/).pop() ?? ''
    const name = sanitizeFileName(sourceName, `resource-${Date.now()}`)
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