import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },

  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:write-file', path, content),
    readdir: (path: string) => ipcRenderer.invoke('fs:readdir', path),
    mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
    rm: (path: string) => ipcRenderer.invoke('fs:rm', path),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    stat: (path: string) => ipcRenderer.invoke('fs:stat', path)
  },

  workspace: {
    getAccounts: () => ipcRenderer.invoke('workspace:get-accounts'),
    getContents: (filters?: Record<string, string>) => ipcRenderer.invoke('workspace:get-contents', filters),
    getContent: (id: string) => ipcRenderer.invoke('workspace:get-content', id),
    createContent: (data: Record<string, unknown>) => ipcRenderer.invoke('workspace:create-content', data),
    updateContent: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('workspace:update-content', id, data),
    deleteContent: (id: string) => ipcRenderer.invoke('workspace:delete-content', id),
    getTemplates: () => ipcRenderer.invoke('workspace:get-templates'),
    getAssets: (type?: string) => ipcRenderer.invoke('workspace:get-assets', type)
  },

  render: {
    start: (data: Record<string, unknown>) => ipcRenderer.invoke('render:start', data),
    cancel: (jobId: string) => ipcRenderer.invoke('render:cancel', jobId),
    jobs: () => ipcRenderer.invoke('render:jobs'),
    thumbnail: (videoPath: string, outputPath: string) => ipcRenderer.invoke('render:thumbnail', videoPath, outputPath),
    setConcurrency: (n: number) => ipcRenderer.invoke('render:set-concurrency', n)
  },

  backup: {
    export: (outputPath?: string) => ipcRenderer.invoke('backup:export', outputPath),
    import: (zipPath: string) => ipcRenderer.invoke('backup:import', zipPath),
    info: () => ipcRenderer.invoke('backup:info')
  },

  settings: {
    read: () => ipcRenderer.invoke('settings:read'),
    write: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:write', settings)
  },

  batch: {
    parseCsv: (csvPath: string) => ipcRenderer.invoke('batch:parse-csv', csvPath),
    createContent: (accountId: string, rows: Record<string, string>[], templateId?: string) => ipcRenderer.invoke('batch:create-content', accountId, rows, templateId),
    enqueueAll: (contentIds: string[], preset?: string) => ipcRenderer.invoke('batch:enqueue-all', contentIds, preset),
    exportCsv: (outputPath: string) => ipcRenderer.invoke('batch:export-csv', outputPath)
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => { ipcRenderer.removeListener(channel, handler) }
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },
  send: (channel: string, ...args: unknown[]) => {
    ipcRenderer.send(channel, ...args)
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)

export type ElectronAPI = typeof electronAPI
