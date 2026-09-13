import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { logError } from '@main/errors'
import { createAppError, toIPCError, type ErrorCode } from '@shared/errors'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler<TArgs extends any[] = any[]> = (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<unknown> | unknown

export function safeIpcMain(
  channel: string,
  handler: IpcHandler,
  errorCode: ErrorCode = 'IPC_HANDLER_ERROR'
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const result = await handler(event, ...args)
      return result
    } catch (err) {
      const appErr = createAppError(
        errorCode,
        err instanceof Error ? err.message : String(err),
        'ipc',
        { channel, args: args.slice(0, 3) }
      )
      await logError(appErr)
      console.error(`[IPC] Error in "${channel}":`, err)
      return toIPCError(err, errorCode)
    }
  })
}

export function registerSafeIpc(mainWindow: BrowserWindow): void {
  safeIpcMain('ping', async () => 'pong')
  safeIpcMain('window:minimize', async () => { mainWindow.minimize() })
  safeIpcMain('window:maximize', async () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  safeIpcMain('window:close', async () => { mainWindow.close() })
  console.log('[IPC] Safe IPC handlers registered')
}
