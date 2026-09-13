import type { ErrorCode, IPCResult } from '@shared/errors'
import { userMessageFor } from '@shared/errors'
import { logRendererError, createRendererError } from './error-logger'

export interface IpcCallOptions<T> {
  call: () => Promise<IPCResult<T>>
  showError?: (msg: string) => void
  showSuccess?: (msg: string) => void
  successMessage?: string
  errorPrefix?: string
  logCode?: ErrorCode
}

export type IpcCallResult<T> =
  | { ok: true; data: T | undefined; requestId?: string }
  | { ok: false; code: ErrorCode; message: string; technical: string; requestId?: string }

/**
 * Central renderer IPC caller. Replaces ad-hoc try/catch in hooks/pages.
 * Technical errors stay in logs; toasts show Indonesian user messages.
 */
export async function callIpc<T>(options: IpcCallOptions<T>): Promise<IpcCallResult<T>> {
  try {
    const result = await options.call()
    if (result.success) {
      if (options.successMessage && options.showSuccess) {
        options.showSuccess(options.successMessage)
      }
      return { ok: true, data: result.data, requestId: result.requestId }
    }
    const code = result.errorCode ?? options.logCode ?? 'IPC_HANDLER_ERROR'
    const technical = result.error ?? 'Operation failed'
    let message: string
    if (code === 'IPC_HANDLER_ERROR' && technical.includes('belum tersedia')) {
      message = 'Aplikasi belum siap. Tunggu beberapa saat atau mulai ulang.'
    } else if (options.errorPrefix) {
      message = `${options.errorPrefix}: ${userMessageFor(code, technical)}`
    } else {
      message = userMessageFor(code, technical)
    }
    logRendererError(createRendererError(code, technical, { requestId: result.requestId }))
    options.showError?.(message)
    return { ok: false, code, message, technical, requestId: result.requestId }
  } catch (err) {
    const technical = err instanceof Error ? err.message : String(err)
    const isBridgeError = technical.includes('belum tersedia') || technical.includes('bridge') || technical.includes('Preload bridge')
    const code = isBridgeError ? 'IPC_HANDLER_ERROR' : (options.logCode ?? 'IPC_HANDLER_ERROR')
    logRendererError(createRendererError(code, technical, err))
    let message: string
    if (isBridgeError) {
      message = 'Aplikasi belum siap sepenuhnya. Tunggu beberapa saat atau mulai ulang aplikasi.'
    } else if (options.errorPrefix) {
      message = `${options.errorPrefix}: ${userMessageFor(code, technical)}`
    } else {
      message = userMessageFor(code, technical)
    }
    options.showError?.(message)
    return { ok: false, code, message, technical }
  }
}

export function requireBridge<T>(value: T | undefined, name: string): T {
  if (!value) {
    throw new Error(`Preload bridge "${name}" belum tersedia. Aplikasi mungkin perlu di-restart.`)
  }
  return value
}
