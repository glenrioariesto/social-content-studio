import { spawn } from 'child_process'
import { logInfo, logError } from '@main/errors'
import { createAppError } from '@shared/errors'
import { classifyFfmpegError } from './typesafe-client'

export interface RenderOptions {
  inputPath: string
  outputPath: string
  width: number
  height: number
  fps: number
  overlayPath?: string
  overlayPosition?: string
  audioPath?: string
  preset?: string
  onProgress?: (percent: number) => void
}

function buildFfmpegArgs(opts: RenderOptions): string[] {
  const args: string[] = []
  args.push('-i', opts.inputPath)

  const filters: string[] = []
  filters.push(`scale=${opts.width}:${opts.height}:force_original_aspect_ratio=decrease`)
  filters.push(`pad=${opts.width}:${opts.height}:(ow-iw)/2:(oh-ih)/2:color=black`)

  if (opts.overlayPath) {
    filters.push(`overlay=${getOverlayPosition(opts.overlayPosition)}`)
  }

  if (filters.length > 0) {
    args.push('-vf', filters.join(','))
  }

  args.push('-c:v', 'libx264', '-preset', opts.preset || 'medium')
  args.push('-r', String(opts.fps))
  args.push('-pix_fmt', 'yuv420p')
  args.push('-c:a', 'aac', '-b:a', '128k')
  args.push('-movflags', '+faststart')
  args.push('-y', opts.outputPath)

  return args
}

function getOverlayPosition(position?: string): string {
  switch (position) {
    case 'top-left': return '20:20'
    case 'top-right': return 'main_w-overlay_w-20:20'
    case 'bottom-left': return '20:main_h-overlay_h-20'
    case 'bottom-right': return 'main_w-overlay_w-20:main_h-overlay_h-20'
    case 'center': return '(main_w-overlay_w)/2:(main_h-overlay_h)/2'
    default: return '(main_w-overlay_w)/2:(main_h-overlay_h)/2'
  }
}

export async function renderVideo(opts: RenderOptions): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  return new Promise((resolve) => {
    const args = buildFfmpegArgs(opts)
    logInfo(`FFmpeg render started: ${opts.outputPath}`)

    let durationSeconds = 30 // fallback estimate
    let stderr = ''

    // First pass: get input duration for accurate progress
    const probeArgs = ['-i', opts.inputPath]
    const probeProc = spawn('ffmpeg', probeArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
    probeProc.stderr.on('data', (data: Buffer) => {
      const line = data.toString()
      const durMatch = line.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
      if (durMatch) {
        durationSeconds = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3])
      }
    })
    probeProc.on('close', () => {
      startRender()
    })
    probeProc.on('error', () => {
      // If probe fails, proceed with fallback estimate
      startRender()
    })

    function startRender() {
      const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] })

      proc.stderr.on('data', (data: Buffer) => {
        const line = data.toString()
        stderr += line
        const match = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        if (match && opts.onProgress) {
          const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3])
          const pct = durationSeconds > 0 ? Math.min(99, Math.floor((seconds / durationSeconds) * 100)) : 0
          opts.onProgress(pct)
        }
      })

      proc.on('close', (code) => {
        if (code === 0) {
          logInfo(`FFmpeg render completed: ${opts.outputPath}`)
          opts.onProgress?.(100)
          resolve({ success: true, outputPath: opts.outputPath })
        } else {
          const rawStderr = stderr.slice(-500)
          
          classifyFfmpegError(rawStderr).then((choice) => {
            let userMessage = `FFmpeg error (code ${code})`
            
            if (choice === 'codec_unsupported') userMessage = "Format video sumber tidak didukung oleh preset render ini."
            else if (choice === 'file_corrupted') userMessage = "File video sumber rusak atau tidak dapat dibaca."
            else if (choice === 'out_of_memory') userMessage = "Kehabisan memori saat melakukan render video."
            else if (choice === 'unknown') userMessage = `Gagal memproses video (FFmpeg Error Code: ${code}).`
            
            const err = createAppError('FFMPEG_ENCODING_ERROR', userMessage, 'main', rawStderr)
            logError(err)
            resolve({ success: false, error: userMessage })
          })
        }
      })

      proc.on('error', (err) => {
        const appErr = createAppError('FFMPEG_NOT_FOUND', err.message, 'main')
        logError(appErr)
        resolve({ success: false, error: err.message })
      })
    }
  })
}

export async function generateThumbnail(videoPath: string, outputPath: string, timeSeconds = 1): Promise<boolean> {
  return new Promise((resolve) => {
    const args = [
      '-i', videoPath,
      '-ss', String(timeSeconds),
      '-vframes', '1',
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
      '-y', outputPath
    ]
    const proc = spawn('ffmpeg', args, { stdio: 'pipe' })
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}
