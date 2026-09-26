import { join } from 'path'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { app } from 'electron'
import { spawn } from 'child_process'
import { getWorkspaceRoot, BOOTSTRAP_SETTINGS_PATH } from '@main/services/workspace-root'
import { atomicWriteJson } from '@main/services/persistence'
import { readFile } from 'fs/promises'

// For downloading
import https from 'https'

const downloadFile = (url: string, dest: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) {
          return downloadFile(res.headers.location, dest).then(resolve).catch(reject)
        }
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download, status code: ${res.statusCode}`))
        return
      }

      let data = Buffer.alloc(0)
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk])
      })
      res.on('end', () => {
        writeFile(dest, data).then(resolve).catch(reject)
      })
      res.on('error', reject)
    }).on('error', reject)
  })
}

export async function checkBinary(binaryName: string, expectedExe: string, versionArg: string = '--version'): Promise<{ found: boolean, version?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(expectedExe, [versionArg])
    let out = ''
    proc.stdout.on('data', (d) => out += d.toString())
    proc.stderr.on('data', (d) => out += d.toString())
    
    proc.on('error', () => resolve({ found: false }))
    proc.on('close', (code) => {
      if (code === 0) {
        const firstLine = out.split('\n')[0].trim()
        resolve({ found: true, version: firstLine.substring(0, 50) })
      } else {
        resolve({ found: false })
      }
    })
  })
}

export async function detectOrInstallDependencies(): Promise<{ success: boolean; log: string[], restartRequired?: boolean }> {
  const isWin = process.platform === 'win32'
  if (!isWin) {
    return { success: false, log: ['Auto-install currently only supports Windows.'] }
  }

  const log: string[] = []
  log.push('Starting dependency check...')

  let rawSettings = '{}'
  try {
    rawSettings = await readFile(BOOTSTRAP_SETTINGS_PATH, 'utf-8')
  } catch {}
  
  const settings = JSON.parse(rawSettings)
  let changed = false
  
  // 1. Check/Install yt-dlp
  log.push('Checking yt-dlp...')
  const ytdlpCheck = await checkBinary('yt-dlp', settings.ytDlpPath || 'yt-dlp', '--version')
  if (ytdlpCheck.found) {
    log.push(`Found yt-dlp: ${ytdlpCheck.version}`)
  } else {
    log.push('yt-dlp not found. Downloading latest release...')
    const binDir = join(app.getPath('userData'), 'binaries')
    if (!existsSync(binDir)) {
      await mkdir(binDir, { recursive: true })
    }
    const exePath = join(binDir, 'yt-dlp.exe')
    try {
      await downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', exePath)
      log.push('Downloaded yt-dlp successfully.')
      settings.ytDlpPath = exePath
      changed = true
    } catch (err: any) {
      log.push(`Failed to download yt-dlp: ${err.message}`)
    }
  }

  // 2. Check FFmpeg
  log.push('Checking ffmpeg...')
  const ffmpegCheck = await checkBinary('ffmpeg', settings.ffmpegPath || 'ffmpeg', '-version')
  if (ffmpegCheck.found) {
    log.push(`Found ffmpeg: ${ffmpegCheck.version}`)
  } else {
    log.push('ffmpeg not found. Attempting to locate bundled version or system...')
    // Usually ffmpeg-static provides it, but electron app packaged might not have node_modules.
    // If not found, we can try to find ffmpeg in the dev environment for now.
    // Real downloading ffmpeg is large (100MB+ zip), so we just warn for now or download a small static build if possible.
    // For simplicity, we just look for ffmpeg in the current process env, or we'll say user must install.
    try {
       // Check ffmpeg-static if dev
       const maybeDevFfmpeg = join(process.cwd(), 'node_modules/ffmpeg-static/ffmpeg.exe')
       if (existsSync(maybeDevFfmpeg)) {
         settings.ffmpegPath = maybeDevFfmpeg
         changed = true
         log.push('Found ffmpeg in node_modules.')
       } else {
         log.push('FFmpeg could not be auto-installed. Please download it manually and set the path.')
       }
    } catch (e) {}
  }

  // 3. Check FFprobe
  log.push('Checking ffprobe...')
  const ffprobeCheck = await checkBinary('ffprobe', settings.ffprobePath || 'ffprobe', '-version')
  if (ffprobeCheck.found) {
    log.push(`Found ffprobe: ${ffprobeCheck.version}`)
  } else {
    log.push('ffprobe not found. Attempting to locate bundled version...')
    try {
       const maybeDevFfprobe = join(process.cwd(), 'node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe')
       if (existsSync(maybeDevFfprobe)) {
         settings.ffprobePath = maybeDevFfprobe
         changed = true
         log.push('Found ffprobe in node_modules.')
       } else {
         log.push('FFprobe could not be auto-installed.')
       }
    } catch (e) {}
  }

  if (changed) {
    log.push('Updating settings.json with new binary paths...')
    await atomicWriteJson(BOOTSTRAP_SETTINGS_PATH, settings)
    log.push('Done.')
    return { success: true, log, restartRequired: true }
  }

  log.push('All dependencies are already satisfied or no new paths were configured.')
  return { success: true, log }
}
