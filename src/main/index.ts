import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { initMainErrorHandlers, logError, logInfo } from './errors'
import { createAppError } from '../../packages/shared/src/errors'
import { initFileSystemIpc } from './ipc/filesystem'
import { initAccountsIpc } from './ipc/accounts'
import { registerSafeIpc } from './ipc/safe-handler'
import { initRenderIpc } from './ipc/render'
import { initResourceIpc } from './ipc/resource'
import { initBackupIpc } from './ipc/backup'
import { initBatchIpc } from './ipc/batch'
import { initWatcherService } from './watchers'

let mainWindow: BrowserWindow | null = null

initMainErrorHandlers()

function createWindow(): void {
  try {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1100,
      minHeight: 700,
      show: false,
      title: 'Social Content Studio',
      backgroundColor: '#09090b',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    mainWindow.on('ready-to-show', () => {
      mainWindow?.show()
      logInfo('Main window ready')
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    mainWindow.webContents.on('render-process-gone', (_event: any, details: any) => {
      const err = createAppError('RENDERER_CRASH', `Renderer gone: ${details.reason}`, 'main', details)
      logError(err)
    })

    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    if (rendererUrl) {
      mainWindow.loadURL(rendererUrl)
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    initFileSystemIpc(mainWindow)
    initAccountsIpc()
    registerSafeIpc(mainWindow)
    initRenderIpc(mainWindow)
    initResourceIpc()
    initBackupIpc()
    initBatchIpc()
    initWatcherService(mainWindow)

    logInfo('Application started')
  } catch (err) {
    const appErr = createAppError(
      'UNKNOWN_ERROR',
      err instanceof Error ? err.message : 'Failed to create window',
      'main',
      err
    )
    logError(appErr)
    console.error('[Main] Failed to create window:', err)
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  logInfo('Application shutting down')
})

ipcMain.handle('get-app-path', () => app.getPath('userData'))
