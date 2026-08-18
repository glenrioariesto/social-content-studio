export type ErrorCode =
  | 'FS_READ_ERROR'
  | 'FS_WRITE_ERROR'
  | 'FS_NOT_FOUND'
  | 'FS_PERMISSION_DENIED'
  | 'FS_ALREADY_EXISTS'
  | 'CONTENT_NOT_FOUND'
  | 'CONTENT_INVALID_STATUS'
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_INVALID'
  | 'ACCOUNT_NOT_FOUND'
  | 'RENDER_FAILED'
  | 'RENDER_TIMEOUT'
  | 'FFMPEG_NOT_FOUND'
  | 'FFMPEG_ENCODING_ERROR'
  | 'RESOURCE_DOWNLOAD_FAILED'
  | 'RESOURCE_INVALID_URL'
  | 'WORKSPACE_NOT_INITIALIZED'
  | 'IPC_HANDLER_ERROR'
  | 'RENDERER_CRASH'
  | 'UNKNOWN_ERROR'

export interface AppError {
  code: ErrorCode
  message: string
  details?: unknown
  timestamp: number
  source: 'main' | 'renderer' | 'ipc' | 'renderer-boundary'
  stack?: string
}

export interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  errorCode?: ErrorCode
}

export function createAppError(
  code: ErrorCode,
  message: string,
  source: AppError['source'],
  details?: unknown
): AppError {
  return {
    code,
    message,
    details,
    source,
    timestamp: Date.now(),
    stack: new Error().stack
  }
}

export function toIPCResult<T>(data: T): IPCResult<T> {
  return { success: true, data }
}

export function toIPCError(error: unknown, fallbackCode: ErrorCode = 'UNKNOWN_ERROR'): IPCResult<never> {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const appErr = error as AppError
    return {
      success: false,
      error: appErr.message,
      errorCode: appErr.code
    }
  }
  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      errorCode: fallbackCode
    }
  }
  return {
    success: false,
    error: String(error),
    errorCode: fallbackCode
  }
}
