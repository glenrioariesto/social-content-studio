import { useState } from 'react'
import { FolderOpen, HardDrive, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface WorkspaceSetupPageProps {
  configuredRoot: string | null
  onResolved: () => void
}

export function WorkspaceSetupPage({ configuredRoot, onResolved }: WorkspaceSetupPageProps) {
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string>('')
  const [restartNeeded, setRestartNeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickFolder = async () => {
    setPicking(true)
    setError(null)
    const result = await window.electron.settings.pickWorkspace()
    setPicking(false)
    if (result.success && result.data) {
      setSelected(result.data)
    }
  }

  const useDefaultWorkspace = () => {
    setSelected('')
    setRestartNeeded(true)
    setError(null)
  }

  const saveWorkspace = async () => {
    setSaving(true)
    setError(null)
    const result = await window.electron.settings.write({ workspacePath: selected })
    setSaving(false)
    if (result.success) {
      setRestartNeeded(true)
    } else {
      setError(result.error ?? 'Failed to save workspace folder')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <Card className="w-full max-w-lg space-y-5 p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-950/40 p-2.5">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Workspace folder problem</h1>
            <p className="mt-1 text-sm text-zinc-400">
              The configured workspace folder could not be used:
            </p>
            <p className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 font-mono text-xs text-red-300">
              {configuredRoot}
            </p>
          </div>
        </div>

        {restartNeeded ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-sm text-amber-300">
              <RefreshCw className="h-4 w-4" />
              Settings saved. Restart the application for the workspace folder to take effect.
            </p>
            <Button onClick={onResolved}>Done</Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-400">
              Point the app at a valid folder, or revert to the default workspace.
            </p>

            <div className="space-y-3">
              <Button onClick={pickFolder} disabled={picking} className="w-full">
                <FolderOpen className="h-4 w-4" />
                {picking ? 'Opening…' : 'Choose folder…'}
              </Button>

              {selected && (
                <p className="rounded-lg bg-zinc-900 px-3 py-2 font-mono text-xs text-emerald-300">
                  {selected}
                </p>
              )}

              <Button variant="secondary" onClick={useDefaultWorkspace} className="w-full">
                <HardDrive className="h-4 w-4" />
                Use the default workspace folder
              </Button>

              {selected && (
                <Button onClick={saveWorkspace} disabled={saving} className="w-full">
                  {saving ? 'Saving…' : 'Save workspace folder'}
                </Button>
              )}

              {error && (
                <p className="rounded-lg bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}