import { useState, useEffect, useCallback } from 'react'
import { Download, Upload, HardDrive, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useErrorToast } from '@/hooks/useErrorToast'

interface BackupInfo {
  accounts: number
  contents: number
  templates: number
  resources: number
  assets: number
}

interface AppSettings {
  defaultPreset: string
  maxConcurrentRender: number
  workspacePath?: string
  ffmpegPath?: string
}

export function SettingsPage() {
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const [settings, setSettings] = useState<AppSettings>({ defaultPreset: 'instagram-reels', maxConcurrentRender: 1 })
  const [exporting, setExporting] = useState(false)
  const [workspaceDir, setWorkspaceDir] = useState('')
  const [ffmpegPath, setFfmpegPath] = useState('')
  const [ffmpegStatus, setFfmpegStatus] = useState<{ found: boolean; executable: boolean } | null>(null)
  const [restartNotice, setRestartNotice] = useState(false)
  const { showSuccess, showInfo } = useErrorToast()

  const loadInfo = useCallback(async () => {
    const [infoRes, settingsRes] = await Promise.all([
      (window.electron as any).backup?.info?.(),
      (window.electron as any).settings?.read?.()
    ])
    if (infoRes?.success) setBackupInfo(infoRes.data)
    if (settingsRes?.success) {
      const data = settingsRes.data as AppSettings
      setSettings(data)
      setWorkspaceDir(data.workspacePath || '')
      setFfmpegPath(data.ffmpegPath || '')
    }
  }, [])

  useEffect(() => { loadInfo() }, [loadInfo])

  // REQ-005: immediate ffmpeg validity feedback whenever the path changes.
  useEffect(() => {
    let cancelled = false
    if (!ffmpegPath) { setFfmpegStatus(null); return }
    ;(window.electron as any).settings?.validateFfmpeg?.(ffmpegPath).then((res: any) => {
      if (!cancelled && res?.success) setFfmpegStatus(res.data)
    })
    return () => { cancelled = true }
  }, [ffmpegPath])

  const handleExport = async () => {
    setExporting(true)
    const result = await (window.electron as any).backup?.export?.()
    if (result?.success) {
      showSuccess(`Backup exported to: ${result.data}`)
    } else {
      showInfo('Export failed')
    }
    setExporting(false)
  }

  const handleSaveSettings = async () => {
    const next = { ...settings, workspacePath: workspaceDir, ffmpegPath: ffmpegPath }
    const result = await (window.electron as any).settings?.write?.(next)
    if (result?.success) {
      setSettings(next)
      if (result.requiresRestart) {
        setRestartNotice(true)
        showSuccess('Settings saved — restart required for the workspace path to take effect')
      } else {
        showSuccess('Settings saved')
      }
    } else {
      showInfo(`Save failed: ${result?.error || 'unknown error'}`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Application configuration</p>
      </div>

      {restartNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          The workspace folder change takes effect after you restart the application.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold text-zinc-300">Render Settings</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">Default Preset</label>
                <select
                  value={settings.defaultPreset}
                  onChange={e => setSettings(s => ({ ...s, defaultPreset: e.target.value }))}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                >
                  <option value="instagram-reels">Instagram Reels</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube-shorts">YouTube Shorts</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">Max Concurrent Renders</label>
                <select
                  value={settings.maxConcurrentRender}
                  onChange={e => setSettings(s => ({ ...s, maxConcurrentRender: Number(e.target.value) }))}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              <button
                onClick={handleSaveSettings}
                className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Save Settings
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">FFmpeg</h2>
            <div className="space-y-2">
              <input
                value={ffmpegPath}
                onChange={e => setFfmpegPath(e.target.value)}
                placeholder="Path to ffmpeg executable"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500"
              />
              {ffmpegStatus && (
                <div className={`flex items-center gap-2 text-sm ${ffmpegStatus.found && ffmpegStatus.executable ? 'text-emerald-400' : 'text-red-400'}`}>
                  {ffmpegStatus.found && ffmpegStatus.executable
                    ? <><CheckCircle2 className="h-4 w-4" /> FFmpeg found and executable</>
                    : <><XCircle className="h-4 w-4" /> FFmpeg not found or not executable</>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="mb-4 text-sm font-semibold text-zinc-300">Backup & Export</h2>
            {backupInfo && (
              <div className="mb-4 grid grid-cols-3 gap-3">
                {Object.entries(backupInfo).map(([key, val]) => (
                  <div key={key} className="rounded-lg bg-zinc-800/50 p-3 text-center">
                    <p className="text-lg font-bold">{val}</p>
                    <p className="text-[10px] text-zinc-500 capitalize">{key}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting...' : 'Export Backup'}
              </button>
              <button
                onClick={loadInfo}
                className="flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">Workspace</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <HardDrive className="h-4 w-4" />
                <span>workspace/</span>
              </div>
              <input
                value={workspaceDir}
                onChange={e => setWorkspaceDir(e.target.value)}
                placeholder="Custom workspace folder (requires restart)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-zinc-500">Changing this takes effect after an app restart. The folder must exist.</p>
              <button
                onClick={handleSaveSettings}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                Save Workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
