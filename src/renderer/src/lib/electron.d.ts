export interface ElectronAPI {
  getAppPath: () => Promise<string>
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
  fs: {
    readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>
    writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
    readdir: (path: string) => Promise<{ success: boolean; data?: Array<{ name: string; isDirectory: boolean; isFile: boolean }>; error?: string }>
    mkdir: (path: string) => Promise<{ success: boolean; error?: string }>
    rm: (path: string) => Promise<{ success: boolean; error?: string }>
    exists: (path: string) => Promise<{ success: boolean; data?: boolean; error?: string }>
    stat: (path: string) => Promise<{ success: boolean; data?: { isFile: boolean; isDirectory: boolean; size: number; mtime: string; birthtime: string }; error?: string }>
  }
  workspace: {
    getAccounts: () => Promise<{ success: boolean; data?: import('@shared/loaded-entry').LoadedEntry<import('@shared/index').Account>[]; error?: string }>
    getContents: (filters?: Record<string, string>) => Promise<{ success: boolean; data?: import('@shared/loaded-entry').LoadedEntry<import('@shared/index').Content>[]; error?: string }>
    getContent: (id: string) => Promise<{ success: boolean; data?: import('@shared/loaded-entry').LoadedEntry<import('@shared/index').Content>; error?: string }>
    createContent: (data: Record<string, unknown>) => Promise<{ success: boolean; data?: import('@shared/index').Content; error?: string }>
    updateContent: (id: string, data: Record<string, unknown>) => Promise<{ success: boolean; data?: import('@shared/index').Content; error?: string }>
    deleteContent: (id: string) => Promise<{ success: boolean; error?: string }>
    getTemplates: () => Promise<{ success: boolean; data?: import('@shared/loaded-entry').LoadedEntry<import('@shared/template').TemplateDefinition>[]; error?: string }>
    getAssets: (type?: string) => Promise<{ success: boolean; data?: Record<string, string[]>; error?: string }>
  }
  account: {
    create: (data: { name: string; description?: string; replizId?: string }) => Promise<{ success: boolean; data?: import('@shared/index').Account; error?: string; errorCode?: string }>
    update: (id: string, data: Record<string, unknown>) => Promise<{ success: boolean; data?: import('@shared/index').Account; error?: string; errorCode?: string }>
    setLogo: (id: string, sourcePath: string) => Promise<{ success: boolean; data?: import('@shared/index').Account; error?: string; errorCode?: string }>
    getLogoUrl: (id: string) => Promise<{ success: boolean; data?: string | null; error?: string }>
  }
  render: {
    start: (data: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>
    cancel: (jobId: string) => Promise<{ success: boolean; error?: string }>
    jobs: () => Promise<{ success: boolean; data?: import('@shared/render').RenderJobSummary[]; error?: string }>
    thumbnail: (videoPath: string, outputPath: string) => Promise<{ success: boolean; data?: string; error?: string }>
    setConcurrency: (n: number) => Promise<{ success: boolean; error?: string }>
  }
  backup: {
    export: (outputPath?: string) => Promise<{ success: boolean; data?: string; error?: string }>
    import: (zipPath: string) => Promise<{ success: boolean; error?: string }>
    info: () => Promise<{ success: boolean; data?: Record<string, number>; error?: string }>
  }
  settings: {
    read: () => Promise<{ success: boolean; data?: import('@shared/index').AppSettings; error?: string }>
    write: (settings: Record<string, unknown>) => Promise<{ success: boolean; requiresRestart?: boolean; error?: string }>
    validateFfmpeg: (ffmpegPath: string) => Promise<{ success: boolean; data?: { found: boolean; isFile: boolean }; error?: string }>
  }
  repliz: {
    getCredentialsStatus: () => Promise<import('@shared/errors').IPCResult<import('@shared/index').ReplizCredentialsStatus>>
    saveCredentials: (accessKey: string, secretKey: string) => Promise<import('@shared/errors').IPCResult<import('@shared/index').ReplizCredentialsStatus>>
    verifyAccount: (accountId: string, replizId: string) => Promise<import('@shared/errors').IPCResult<{ account: import('@shared/index').Account; verified: import('@shared/index').ReplizAccountVerifyResult }>>
  }
  batch: {
    parseCsv: (csvPath: string) => Promise<{ success: boolean; data?: { count: number; rows: Record<string, string>[] }; error?: string }>
    createContent: (accountId: string, rows: Record<string, string>[], templateId?: string) => Promise<{ success: boolean; data?: { ids: string[]; count: number }; error?: string }>
    enqueueAll: (contentIds: string[], preset?: string) => Promise<{ success: boolean; data?: { queued: number }; error?: string }>
    exportCsv: (outputPath: string) => Promise<{ success: boolean; data?: string; error?: string }>
  }
  agent: {
    listTools: () => Promise<import('@shared/errors').IPCResult<import('@shared/agent').AgentToolDef[]>>
    invoke: (req: import('@shared/agent').AgentInvokeRequest) => Promise<import('@shared/errors').IPCResult<unknown>>
  }
  resource: {
    list: () => Promise<import('@shared/errors').IPCResult<import('@shared/resource').Resource[]>>
    download: (url: string, fileName?: string) => Promise<import('@shared/errors').IPCResult<import('@shared/resource').Resource>>
    upload: (sourcePath: string, fileName: string) => Promise<import('@shared/errors').IPCResult<import('@shared/resource').Resource>>
    delete: (id: string) => Promise<import('@shared/errors').IPCResult<null>>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
  off: (channel: string, callback: (...args: unknown[]) => void) => void
  send: (channel: string, ...args: unknown[]) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
