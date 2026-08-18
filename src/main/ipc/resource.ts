import { safeIpcMain } from './safe-handler'
import { mkdir, writeFile, readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { logInfo, logError } from '../errors'
import { createAppError } from '../../../packages/shared/src/errors'

function getWorkspacePath(): string {
  return join(process.cwd(), 'workspace')
}

export function initResourceIpc(): void {
  const ws = getWorkspacePath()

  safeIpcMain('resource:list', async () => {
    const resDir = join(ws, 'resources')
    try {
      const entries = await readdir(resDir, { withFileTypes: true })
      const resources = []
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          const raw = await readFile(join(resDir, entry.name), 'utf-8')
          resources.push(JSON.parse(raw))
        }
      }
      return { success: true, data: resources }
    } catch {
      return { success: true, data: [] }
    }
  }, 'FS_READ_ERROR')

  safeIpcMain('resource:download', async (_event, url: string, fileName?: string) => {
    const resDir = join(ws, 'resources')
    await mkdir(resDir, { recursive: true })

    const name = fileName || `resource-${Date.now()}.mp4`
    const outputPath = join(resDir, name)

    logInfo(`Download started: ${url}`)

    return new Promise((resolve) => {
      let proc: ReturnType<typeof spawn>

      if (url.includes('twitter.com') || url.includes('x.com')) {
        proc = spawn('yt-dlp', ['-f', 'best', '-o', outputPath, url], { stdio: 'pipe' })
      } else {
        proc = spawn('yt-dlp', ['-f', 'best', '-o', outputPath, url], { stdio: 'pipe' })
      }

      let stderr = ''
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

      proc.on('close', async (code) => {
        if (code === 0) {
          const meta = {
            id: `res-${Date.now()}`,
            source: 'internet',
            sourceUrl: url,
            fileName: name,
            filePath: outputPath,
            status: 'ready',
            createdAt: new Date().toISOString()
          }
          await writeFile(join(resDir, `${meta.id}.json`), JSON.stringify(meta, null, 2), 'utf-8')
          logInfo(`Download completed: ${name}`)
          resolve({ success: true, data: meta })
        } else {
          logError(createAppError('RESOURCE_DOWNLOAD_FAILED', `Download failed (code ${code})`, 'main', stderr.slice(-500)))
          resolve({ success: false, error: `Download failed (code ${code})` })
        }
      })

      proc.on('error', (err) => {
        logError(createAppError('RESOURCE_DOWNLOAD_FAILED', err.message, 'main'))
        resolve({ success: false, error: err.message })
      })
    })
  }, 'RESOURCE_DOWNLOAD_FAILED')

  safeIpcMain('resource:upload', async (_event, sourcePath: string, fileName: string) => {
    const resDir = join(ws, 'resources')
    await mkdir(resDir, { recursive: true })

    const { copyFile } = await import('fs/promises')
    const outputPath = join(resDir, fileName)
    await copyFile(sourcePath, outputPath)

    const meta = {
      id: `res-${Date.now()}`,
      source: 'upload',
      fileName,
      filePath: outputPath,
      status: 'ready',
      createdAt: new Date().toISOString()
    }
    await writeFile(join(resDir, `${meta.id}.json`), JSON.stringify(meta, null, 2), 'utf-8')
    return { success: true, data: meta }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('resource:delete', async (_event, id: string) => {
    const resDir = join(ws, 'resources')
    const { rm } = await import('fs/promises')
    await rm(join(resDir, `${id}.json`), { force: true })
    return { success: true }
  }, 'FS_WRITE_ERROR')
}
