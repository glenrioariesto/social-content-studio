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

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
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
