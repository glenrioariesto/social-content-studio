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

export function handleIPCCall<T>(
  promise: Promise<{ success: boolean; data?: T; error?: string }>,
  onErrorCallback?: (msg: string) => void
): Promise<T | null> {
  return promise
    .then((result) => {
      if (result.success) {
        return result.data ?? null
      }
      const msg = result.error || 'Operation failed'
      onErrorCallback?.(msg)
      logRendererError(createRendererError('IPC_HANDLER_ERROR', msg))
      return null
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      onErrorCallback?.(msg)
      logRendererError(createRendererError('IPC_HANDLER_ERROR', msg, err))
      return null
    })
}
