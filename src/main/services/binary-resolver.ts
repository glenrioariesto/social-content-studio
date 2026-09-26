import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { BOOTSTRAP_SETTINGS_PATH, getWorkspaceRoot } from '@main/services/workspace-root'

/**
 * Resolves the path to external binaries (ffmpeg, yt-dlp).
 * 
 * Priority:
 * 1. User-configured path in settings.json (if set and valid)
 * 2. Bundled binary in `resources/bin/` (if app is packaged for production)
 * 3. Fallback to system PATH (returns just the binary name)
 */
export async function resolveBinary(binaryName: string): Promise<string> {
  const isWin = process.platform === 'win32'
  const exeName = isWin ? `${binaryName}.exe` : binaryName

  // 1. Check user settings first
  try {
    const raw = await readFile(BOOTSTRAP_SETTINGS_PATH, 'utf-8')
    const settings = JSON.parse(raw)
    
    if (binaryName === 'ffmpeg' && settings.ffmpegPath && existsSync(settings.ffmpegPath)) {
      return settings.ffmpegPath
    }
    if (binaryName === 'ffprobe' && settings.ffprobePath && existsSync(settings.ffprobePath)) {
      return settings.ffprobePath
    }
    if (binaryName === 'yt-dlp' && settings.ytDlpPath && existsSync(settings.ytDlpPath)) {
      return settings.ytDlpPath
    }
  } catch {
    // Ignore settings read errors
  }

  // 2. Check bundled resources (Production)
  if (app.isPackaged) {
    const bundledPath = join(process.resourcesPath, 'bin', exeName)
    if (existsSync(bundledPath)) {
      return bundledPath
    }
  } else {
    // Check local binaries folder during development using import.meta.dirname 
    // which points to out/main and is immune to cwd differences.
    const platformFolder = isWin ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'
    const devPath = join(import.meta.dirname, '../../binaries', platformFolder, exeName)
    if (existsSync(devPath)) {
      return devPath
    }
  }

  // 3. Fallback to system PATH
  return exeName
}
