import { safeIpcMain } from './safe-handler'
import { join } from 'path'
import { readFile, readdir, writeFile, stat } from 'fs/promises'
import { logInfo, logError } from '../errors'
import { createAppError } from '../../../packages/shared/src/errors'

export function initBackupIpc(): void {
  const ws = join(process.cwd(), 'workspace')

  safeIpcMain('backup:export', async (_event, outputPath?: string) => {
    const { execSync } = await import('child_process')
    const outPath = outputPath || join(process.cwd(), `social-content-backup-${new Date().toISOString().split('T')[0]}.zip`)

    try {
      execSync(`powershell -Command "Compress-Archive -Path '${ws}\\*' -DestinationPath '${outPath}' -Force"`, { stdio: 'pipe' })
      logInfo(`Backup exported: ${outPath}`)
      return { success: true, data: outPath }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('backup:import', async (_event, zipPath: string) => {
    const { execSync } = await import('child_process')
    try {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${ws}' -Force"`, { stdio: 'pipe' })
      logInfo(`Backup imported: ${zipPath}`)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('backup:info', async () => {
    const dirs = ['accounts', 'contents', 'templates', 'resources', 'assets']
    const info: Record<string, number> = {}
    for (const dir of dirs) {
      try {
        const entries = await readdir(join(ws, dir), { withFileTypes: true })
        info[dir] = entries.length
      } catch {
        info[dir] = 0
      }
    }
    return { success: true, data: info }
  }, 'FS_READ_ERROR')

  safeIpcMain('settings:read', async () => {
    try {
      const raw = await readFile(join(ws, 'config', 'settings.json'), 'utf-8')
      return { success: true, data: JSON.parse(raw) }
    } catch {
      return { success: true, data: { defaultPreset: 'instagram-reels', maxConcurrentRender: 1 } }
    }
  }, 'FS_READ_ERROR')

  safeIpcMain('settings:write', async (_event, settings: Record<string, unknown>) => {
    await writeFile(join(ws, 'config', 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8')
    return { success: true }
  }, 'FS_WRITE_ERROR')
}
