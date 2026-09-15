import { safeIpcMain } from './safe-handler'
import { join } from 'path'
import { readFile, readdir, writeFile, stat } from 'fs/promises'
import { existsSync, statSync } from 'fs'
import { spawn } from 'child_process'
import AdmZip from 'adm-zip'
import { dialog } from 'electron'
import { logInfo, logError } from '@main/errors'
import { createAppError } from '@shared/errors'
import { getWorkspaceRoot, BOOTSTRAP_SETTINGS_PATH } from '@main/services/workspace-root'
import { assertInsideWorkspace } from '@main/services/path-guard'
import { validateZipEntries } from '@main/services/zip-entries'
import { atomicWriteJson } from '@main/services/persistence'

export function initBackupIpc(): void {
  const ws = () => getWorkspaceRoot()

  safeIpcMain('backup:export', async (_event, outputPath?: string) => {
    const root = ws()
    const outPath = outputPath
      ? assertInsideWorkspace(root, outputPath, 'backup:export').absolute
      : join(root, `social-content-backup-${new Date().toISOString().split('T')[0]}.zip`)

    try {
      const zip = new AdmZip()
      // adm-zip reads the directory from disk directly — no shell is spawned,
      // so renderer-supplied outputPath can no longer inject commands (SEC-01).
      zip.addLocalFolder(root)
      zip.writeZip(outPath)
      logInfo(`Backup exported: ${outPath}`)
      return { success: true, data: outPath }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('backup:import', async (_event, zipPath: string) => {
    const root = ws()
    // Confine the caller-supplied archive path before touching it (SEC-01/SEC-02).
    const confined = assertInsideWorkspace(root, zipPath, 'backup:import').absolute
    try {
      const zip = new AdmZip(confined)
      // Reject any entry that could escape the workspace on extract (zip-slip,
      // SEC-02): absolute paths, drive volumes, `..` segments, symlinks, empty names.
      const offenders = validateZipEntries(zip.getEntries())
      if (offenders.length > 0) {
        logError(createAppError('FS_VALIDATION_ERROR', `Backup import refused: unsafe zip entries (${offenders.join(', ')})`, 'ipc', { channel: 'backup:import' }))
        return { success: false, error: `Backup import refused: unsafe zip entries`, errorCode: 'FS_VALIDATION_ERROR' }
      }
      zip.extractAllTo(root, /*overwrite*/ true)
      logInfo(`Backup imported: ${confined}`)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('backup:info', async () => {
    const root = ws()
    const dirs = ['accounts', 'contents', 'templates', 'resources', 'assets']
    const info: Record<string, number> = {}
    for (const dir of dirs) {
      try {
        const entries = await readdir(join(root, dir), { withFileTypes: true })
        info[dir] = entries.length
      } catch {
        info[dir] = 0
      }
    }
    return { success: true, data: info }
  }, 'FS_READ_ERROR')

  safeIpcMain('settings:read', async () => {
    try {
      const raw = await readFile(BOOTSTRAP_SETTINGS_PATH, 'utf-8')
      return { success: true, data: JSON.parse(raw) }
    } catch {
      return { success: true, data: { defaultPreset: 'instagram-reels', maxConcurrentRender: 1 } }
    }
  }, 'FS_READ_ERROR')

  safeIpcMain('settings:write', async (_event, settings: Record<string, unknown>) => {
    // REQ-004: validate the configured workspace folder exists and is a directory
    // before persisting. The new root only takes effect after an app restart.
    if (typeof settings.workspacePath === 'string' && settings.workspacePath.length > 0) {
      try {
        if (!existsSync(settings.workspacePath) || !statSync(settings.workspacePath).isDirectory()) {
          return { success: false, error: 'workspacePath does not exist or is not a directory', errorCode: 'FS_NOT_FOUND' }
        }
      } catch {
        return { success: false, error: 'workspacePath does not exist', errorCode: 'FS_NOT_FOUND' }
      }
    }
    // CON-001 + REQ-004: the bootstrap settings file (cwd/workspace) is the single
    // pointer to the active workspace; writing anywhere else would make a second
    // switch or a revert invisible to getWorkspaceRoot() on the next restart.
    await atomicWriteJson(BOOTSTRAP_SETTINGS_PATH, settings) // CON-001: atomic
    return { success: true, requiresRestart: true }
  }, 'FS_WRITE_ERROR')

  // REQ-004 / AC-008: non-throwing workspace probe. The renderer uses this on
  // launch to decide whether to show the guided setup state. It must never throw,
  // even when the configured folder is missing/invalid.
  safeIpcMain('settings:status', async () => {
    let configured: string | undefined
    try {
      const raw = await readFile(BOOTSTRAP_SETTINGS_PATH, 'utf-8')
      const parsed = JSON.parse(raw) as { workspacePath?: string }
      if (parsed && typeof parsed.workspacePath === 'string' && parsed.workspacePath.length > 0) {
        configured = parsed.workspacePath
      }
    } catch {
      // no bootstrap settings yet — first run
    }

    const fallbackRoot = join(process.cwd(), 'workspace')

    if (!configured) {
      return { success: true, data: { valid: true, configuredRoot: null, activeRoot: fallbackRoot } }
    }

    try {
      if (!existsSync(configured) || !statSync(configured).isDirectory()) {
        return { success: true, data: { valid: false, configuredRoot: configured, activeRoot: fallbackRoot } }
      }
      return { success: true, data: { valid: true, configuredRoot: configured, activeRoot: configured } }
    } catch {
      return { success: true, data: { valid: false, configuredRoot: configured, activeRoot: fallbackRoot } }
    }
  }, 'FS_READ_ERROR')

  // REQ-004 / AC-008: native folder picker for the guided setup state. Returns the
  // chosen absolute path or null if cancelled. (SEC-001 exempt: explicit user intent
  // via the native dialog is the sole selector of the workspace root.)
  safeIpcMain('settings:pick-workspace', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return { success: true, data: null }
    return { success: true, data: result.filePaths[0] }
  }, 'FS_READ_ERROR')

  safeIpcMain('settings:validate-ffmpeg', async (_event, ffmpegPath: string) => {
    // NIT-08: report honestly. `isFile` (not `executable`) — a non-directory
    // file may still be the wrong binary. Optional real check below.
    if (!existsSync(ffmpegPath)) return { success: true, data: { found: false, isFile: false } }
    if (!statSync(ffmpegPath).isFile()) return { success: true, data: { found: false, isFile: false } }

    const isRealFfmpeg = await new Promise<boolean>(resolve => {
      const proc = spawn(ffmpegPath, ['-version'])
      proc.on('error', () => resolve(false))
      proc.on('close', code => resolve(code === 0))
    })
    return { success: true, data: { found: true, isFile: isRealFfmpeg } }
  }, 'FS_READ_ERROR')
}
