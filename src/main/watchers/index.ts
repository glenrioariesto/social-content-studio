import { BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import { join } from 'path'

let watcher: FSWatcher | null = null

export function initWatcherService(mainWindow: BrowserWindow): void {
  const workspacePath = join(process.cwd(), 'workspace')

  watcher = watch(
    [
      join(workspacePath, 'templates/**/*'),
      join(workspacePath, 'contents/**/*'),
      join(workspacePath, 'resources/**/*'),
      join(workspacePath, 'accounts/**/*'),
      join(workspacePath, 'assets/**/*')
    ],
    {
      ignored: /(^|[\/\\])\.(?!pop)/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    }
  )

  const debounce = new Map<string, ReturnType<typeof setTimeout>>()

  function sendEvent(type: string, filePath: string): void {
    const key = `${type}:${filePath}`
    if (debounce.has(key)) clearTimeout(debounce.get(key)!)
    debounce.set(key, setTimeout(() => {
      debounce.delete(key)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('fs:changed', {
          type,
          path: filePath,
          relativePath: filePath.replace(workspacePath, '').replace(/\\/g, '/'),
          timestamp: Date.now()
        })
      }
    }, 300))
  }

  watcher
    .on('add', (path) => sendEvent('file.created', path))
    .on('change', (path) => sendEvent('file.modified', path))
    .on('unlink', (path) => sendEvent('file.deleted', path))
    .on('addDir', (path) => sendEvent('dir.created', path))
    .on('unlinkDir', (path) => sendEvent('dir.deleted', path))
}
