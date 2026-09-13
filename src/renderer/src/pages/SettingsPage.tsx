import { useState, useEffect, useCallback } from 'react'
import { Download, Upload, HardDrive, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useErrorToast } from '@/hooks/useErrorToast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Field'

interface BackupInfo {
  [key: string]: number
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
  const [ffmpegStatus, setFfmpegStatus] = useState<{ found: boolean; isFile: boolean } | null>(null)
  const [restartNotice, setRestartNotice] = useState(false)
  const { showSuccess, showInfo } = useErrorToast()

  const loadInfo = useCallback(async () => {
    const [infoRes, settingsRes] = await Promise.all([
      window.electron.backup.info(),
      window.electron.settings.read()
    ])
    if (infoRes.success && infoRes.data) setBackupInfo(infoRes.data)
    if (settingsRes.success && settingsRes.data) {
      const data = settingsRes.data
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
    ;(window.electron.settings.validateFfmpeg(ffmpegPath)).then((res) => {
      if (!cancelled && res.success && res.data) setFfmpegStatus(res.data)
    })
    return () => { cancelled = true }
  }, [ffmpegPath])

  const handleExport = async () => {
    setExporting(true)
    const result = await window.electron.backup.export()
    if (result.success) {
      showSuccess(`Backup exported to: ${result.data}`)
    } else {
      showInfo('Export failed')
    }
    setExporting(false)
  }

  const handleSaveSettings = async () => {
    const next = { ...settings, workspacePath: workspaceDir, ffmpegPath: ffmpegPath }
    const result = await window.electron.settings.write(next)
    if (result.success) {
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
        <Card className="flex items-center gap-2 border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          The workspace folder change takes effect after you restart the application.
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-zinc-300">Render Settings</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">Default Preset</label>
                <Select
                  value={settings.defaultPreset}
                  onChange={e => setSettings(s => ({ ...s, defaultPreset: e.target.value }))}
                  className="py-1.5"
                >
                  <option value="instagram-reels">Instagram Reels</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube-shorts">YouTube Shorts</option>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">Max Concurrent Renders</label>
                <Select
                  value={settings.maxConcurrentRender}
                  onChange={e => setSettings(s => ({ ...s, maxConcurrentRender: Number(e.target.value) }))}
                  className="py-1.5"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </Select>
              </div>
              <Button onClick={handleSaveSettings} className="mt-2">
                Save Settings
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">FFmpeg</h2>
            <div className="space-y-2">
              <Input
                value={ffmpegPath}
                onChange={e => setFfmpegPath(e.target.value)}
                placeholder="Path to ffmpeg executable"
              />
              {ffmpegStatus && (
                <div className={`flex items-center gap-2 text-sm ${ffmpegStatus.found && ffmpegStatus.isFile ? 'text-emerald-400' : 'text-red-400'}`}>
                  {ffmpegStatus.found && ffmpegStatus.isFile
                    ? <><CheckCircle2 className="h-4 w-4" /> FFmpeg found and valid</>
                    : <><XCircle className="h-4 w-4" /> FFmpeg not found or not valid</>}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
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
              <Button
                variant="secondary"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting...' : 'Export Backup'}
              </Button>
              <Button variant="outline" onClick={loadInfo}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">Workspace</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <HardDrive className="h-4 w-4" />
                <span>workspace/</span>
              </div>
              <Input
                value={workspaceDir}
                onChange={e => setWorkspaceDir(e.target.value)}
                placeholder="Custom workspace folder (requires restart)"
              />
              <p className="text-[11px] text-zinc-500">Changing this takes effect after an app restart. The folder must exist.</p>
              <Button variant="secondary" onClick={handleSaveSettings}>
                Save Workspace
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
