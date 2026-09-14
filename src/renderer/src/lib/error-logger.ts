import type { AppError, ErrorCode } from '@shared/errors'

export type ErrorInfo = {
  code: ErrorCode
  message: string
  source: AppError['source']
  details?: unknown
  timestamp: number
}

let errorListeners: Array<(error: ErrorInfo) => void> = []

export function onError(callback: (error: ErrorInfo) => void): () => void {
  errorListeners.push(callback)
  return () => {
    errorListeners = errorListeners.filter(l => l !== callback)
  }
}

function notify(error: ErrorInfo): void {
  errorListeners.forEach(cb => {
    try { cb(error) } catch { /* listener error */ }
  })
}

export function logRendererError(info: ErrorInfo): void {
  notify(info)
  console.error(`[Renderer Error] [${info.code}] ${info.message}`, info.details)
}

export function createRendererError(
  code: ErrorCode,
  message: string,
  details?: unknown
): ErrorInfo {
  const info: ErrorInfo = {
    code,
    message,
    source: 'renderer',
    details,
    timestamp: Date.now()
  }
  return info
}
