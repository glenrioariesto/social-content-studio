import { spawn } from 'child_process'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, basename } from 'path'
import { logInfo, logError } from '../errors'
import { createAppError } from '../../../packages/shared/src/errors'

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

    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stderr = ''

    proc.stderr.on('data', (data: Buffer) => {
      const line = data.toString()
      stderr += line
      const match = line.match(/time=(\d{2}):(\d{2}):(\d{2})/)
      if (match && opts.onProgress) {
        const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
        opts.onProgress(Math.min(99, Math.floor((seconds / 30) * 100)))
      }
    })

    proc.on('close', (code) => {
      if (code === 0) {
        logInfo(`FFmpeg render completed: ${opts.outputPath}`)
        opts.onProgress?.(100)
        resolve({ success: true, outputPath: opts.outputPath })
      } else {
        const err = createAppError('FFMPEG_ENCODING_ERROR', `FFmpeg exited with code ${code}`, 'main', stderr.slice(-500))
        logError(err)
        resolve({ success: false, error: `FFmpeg error (code ${code})` })
      }
    })

    proc.on('error', (err) => {
      const appErr = createAppError('FFMPEG_NOT_FOUND', err.message, 'main')
      logError(appErr)
      resolve({ success: false, error: err.message })
    })
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

export async function renderFromTemplate(
  templateDir: string,
  resourcePath: string,
  outputPath: string,
  variables: Record<string, string>,
  onProgress?: (p: number) => void
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  const htmlPath = join(templateDir, 'index.html')
  const cssPath = join(templateDir, 'style.css')
  const jsonPath = join(templateDir, 'template.json')

  let html = await readFile(htmlPath, 'utf-8').catch(() => '')
  const css = await readFile(cssPath, 'utf-8').catch(() => '')
  const json = JSON.parse(await readFile(jsonPath, 'utf-8').catch(() => '{}'))

  for (const [key, val] of Object.entries(variables)) {
    html = html.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), val as string)
  }

  const renderedDir = join(outputPath, '..')
  await mkdir(renderedDir, { recursive: true })
  await writeFile(join(renderedDir, 'rendered.html'), html, 'utf-8')

  return renderVideo({
    inputPath: resourcePath,
    outputPath,
    width: json.output?.width || 1080,
    height: json.output?.height || 1920,
    fps: json.output?.fps || 30,
    overlayPath: json.overlay?.file ? join(templateDir, json.overlay.file) : undefined,
    overlayPosition: json.overlay?.position,
    preset: 'medium',
    onProgress
  })
}
