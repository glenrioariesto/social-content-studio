export type ErrorCode =
  | 'FS_READ_ERROR'
  | 'FS_WRITE_ERROR'
  | 'FS_NOT_FOUND'
  | 'FS_PERMISSION_DENIED'
  | 'FS_ALREADY_EXISTS'
  | 'FS_VALIDATION_ERROR'
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
  | 'REPLIZ_NOT_CONFIGURED'
  | 'REPLIZ_UNAUTHORIZED'
  | 'REPLIZ_RATE_LIMITED'
  | 'REPLIZ_NETWORK_ERROR'
  | 'REPLIZ_ACCOUNT_NOT_FOUND'
  | 'WORKSPACE_NOT_INITIALIZED'
  | 'AGENT_UNKNOWN_TOOL'
  | 'AGENT_AMBIGUOUS_REQUEST'
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
  requestId?: string
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

export function ok<T>(data: T): IPCResult<T> {
  return { success: true, data }
}

export function fail<T = never>(code: ErrorCode, message: string, details?: unknown): IPCResult<T> {
  void details
  return { success: false, error: message, errorCode: code }
}

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.code === 'string' && typeof v.message === 'string' && typeof v.timestamp === 'number' && typeof v.source === 'string'
}

/**
 * Indonesian user-facing messages. Technical details stay in logs;
 * renderer toasts should prefer this map over raw error strings.
 */
export const ERROR_USER_MESSAGES: Record<ErrorCode, string> = {
  FS_READ_ERROR: 'Gagal membaca data. Coba muat ulang.',
  FS_WRITE_ERROR: 'Gagal menyimpan data. Coba lagi.',
  FS_NOT_FOUND: 'Data tidak ditemukan.',
  FS_PERMISSION_DENIED: 'Akses ditolak. Path berada di luar workspace.',
  FS_ALREADY_EXISTS: 'Data sudah ada.',
  FS_VALIDATION_ERROR: 'Data tidak valid. Periksa kembali input Anda.',
  CONTENT_NOT_FOUND: 'Konten tidak ditemukan.',
  CONTENT_INVALID_STATUS: 'Transisi status tidak diizinkan.',
  TEMPLATE_NOT_FOUND: 'Template tidak ditemukan.',
  TEMPLATE_INVALID: 'Template tidak valid.',
  ACCOUNT_NOT_FOUND: 'Akun tidak ditemukan.',
  RENDER_FAILED: 'Render gagal. Periksa antrean dan coba lagi.',
  RENDER_TIMEOUT: 'Render kehabisan waktu. Coba lagi.',
  FFMPEG_NOT_FOUND: 'FFmpeg tidak ditemukan. Periksa pengaturan ffmpegPath.',
  FFMPEG_ENCODING_ERROR: 'Gagal encoding video. Periksa file sumber.',
  RESOURCE_DOWNLOAD_FAILED: 'Gagal mengunduh resource.',
  RESOURCE_INVALID_URL: 'URL resource tidak valid.',
  REPLIZ_NOT_CONFIGURED: 'Kredensial Repliz belum diatur. Buka Settings → Repliz.',
  REPLIZ_UNAUTHORIZED: 'Otentikasi Repliz gagal. Periksa Access Key & Secret Key.',
  REPLIZ_RATE_LIMITED: 'Terlalu banyak permintaan ke Repliz. Coba lagi nanti.',
  REPLIZ_NETWORK_ERROR: 'Gagal terhubung ke Repliz. Periksa koneksi internet.',
  REPLIZ_ACCOUNT_NOT_FOUND: 'Akun Repliz tidak ditemukan.',
  WORKSPACE_NOT_INITIALIZED: 'Workspace belum diinisialisasi.',
  AGENT_UNKNOWN_TOOL: 'Tool agent tidak dikenal.',
  AGENT_AMBIGUOUS_REQUEST: 'Permintaan agent ambigu dan dihentikan.',
  IPC_HANDLER_ERROR: 'Terjadi kesalahan internal. Coba lagi.',
  RENDERER_CRASH: 'Tampilan mengalami crash. Muat ulang aplikasi.',
  UNKNOWN_ERROR: 'Terjadi kesalahan tak dikenal. Coba lagi.'
}

export function userMessageFor(code: ErrorCode | undefined, fallback?: string): string {
  if (code && ERROR_USER_MESSAGES[code]) return ERROR_USER_MESSAGES[code]
  return fallback ?? ERROR_USER_MESSAGES.UNKNOWN_ERROR
}

export function toIPCError(error: unknown, fallbackCode: ErrorCode = 'UNKNOWN_ERROR'): IPCResult<never> {
  if (isAppError(error)) {
    return {
      success: false,
      error: error.message,
      errorCode: error.code
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

// Result type for explicit error handling without exceptions
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export function okResult<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function errResult<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

export function isResult<T>(value: unknown): value is Result<T> {
  return typeof value === 'object' && value !== null && 'ok' in value
}
