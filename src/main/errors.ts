import { app, BrowserWindow } from 'electron'
import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { createAppError, type AppError } from '../../packages/shared/src/errors'

const LOG_DIR = join(process.cwd(), 'workspace', 'config', 'logs')
let logInitialized = false

async function ensureLogDir(): Promise<void> {
  if (logInitialized) return
  try {
    await mkdir(LOG_DIR, { recursive: true })
    logInitialized = true
  } catch {
    logInitialized = false
  }
}

async function writeLog(level: string, error: AppError): Promise<void> {
  await ensureLogDir()
  const date = new Date().toISOString().split('T')[0]
  const logFile = join(LOG_DIR, `${date}.log`)
  const line = `[${new Date().toISOString()}] [${level}] [${error.source}] ${error.code}: ${error.message}\n${error.stack ? error.stack + '\n' : ''}${error.details ? `Details: ${JSON.stringify(error.details)}\n` : ''}\n`
  try {
    await appendFile(logFile, line, 'utf-8')
  } catch {
    // silent fail if log write fails
  }
}

export function initMainErrorHandlers(): void {
  process.on('uncaughtException', async (err) => {
    const appErr = createAppError('UNKNOWN_ERROR', err.message, 'main', {
      name: err.name,
      code: (err as NodeJS.ErrnoException).code
    })
    await writeLog('UNCAUGHT_EXCEPTION', appErr)
    console.error('[Main] Uncaught Exception:', err)
  })

  process.on('unhandledRejection', async (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    const appErr = createAppError('UNKNOWN_ERROR', message, 'main', reason)
    await writeLog('UNHANDLED_REJECTION', appErr)
    console.error('[Main] Unhandled Rejection:', reason)
  })

  app.on('render-process-gone', async (_event: any, details: any) => {
    const appErr = createAppError('RENDERER_CRASH', `Renderer crashed: ${details?.reason || 'unknown'}`, 'main', details)
    await writeLog('RENDERER_CRASH', appErr)
  })

  app.on('child-process-gone', async (_event: any, details: any) => {
    const appErr = createAppError('UNKNOWN_ERROR', `Child process exited: ${details?.type || 'unknown'}`, 'main', details)
    await writeLog('CHILD_PROCESS_GONE', appErr)
  })
}

export async function logError(error: AppError): Promise<void> {
  await writeLog('ERROR', error)
}

export async function logInfo(message: string): Promise<void> {
  await ensureLogDir()
  const date = new Date().toISOString().split('T')[0]
  const logFile = join(LOG_DIR, `${date}.log`)
  const line = `[${new Date().toISOString()}] [INFO] ${message}\n`
  try {
    await appendFile(logFile, line, 'utf-8')
  } catch {
    // silent
  }
}
