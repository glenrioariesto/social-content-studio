import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { TitleBar } from './components/layout/TitleBar'
import { DashboardPage } from './pages/DashboardPage'
import { ContentPage } from './pages/ContentPage'
import { ContentDetailPage } from './pages/ContentDetailPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { AssetsPage } from './pages/AssetsPage'
import { AccountsPage } from './pages/AccountsPage'
import { SettingsPage } from './pages/SettingsPage'
import { RenderQueuePage } from './pages/RenderQueuePage'
import { CalendarPage } from './pages/CalendarPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { BatchRenderPage } from './pages/BatchRenderPage'
import { LogsPage } from './pages/LogsPage'
import { AgentStudioPage } from './pages/AgentStudioPage'
import { WorkspaceSetupPage } from './pages/WorkspaceSetupPage'
import { LoadingState } from './components/ui/LoadingState'

interface WorkspaceStatus {
  valid: boolean
  configuredRoot: string | null
  activeRoot: string
}

export function App() {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null)

  useEffect(() => {
    if (!window.electron) {
      // If opened in browser, electron API is missing. Set a specific fake status to show an error.
      setStatus({ valid: false, configuredRoot: 'browser', activeRoot: 'browser' })
      return
    }
    
    let cancelled = false
    if (window.electron && window.electron.settings) {
      window.electron.settings.status().then(result => {
        if (!cancelled && result.success && result.data) setStatus(result.data)
        else if (!cancelled) setStatus({ valid: true, configuredRoot: null, activeRoot: '' })
      }).catch(() => {
        if (!cancelled) setStatus({ valid: true, configuredRoot: null, activeRoot: '' })
      })
    } else {
      setStatus({ valid: false, configuredRoot: 'browser', activeRoot: 'browser' })
    }
    return () => { cancelled = true }
  }, [])

  if (status === null) {
    return <LoadingState label="Checking workspace..." />
  }

  if (!status.valid) {
    if (status.configuredRoot === 'browser') {
      return (
        <div className="flex h-screen items-center justify-center bg-zinc-950 p-8 text-center text-zinc-300">
          <div className="max-w-md space-y-4">
            <h1 className="text-xl font-bold text-red-500">Electron Environment Required</h1>
            <p>
              It looks like you opened the development URL directly in a web browser.
              Because this is a native desktop application, it requires the Electron APIs to access your local filesystem.
            </p>
            <p>Please close this tab and run the app from your terminal using <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">bun run dev</code> so it opens in its own window.</p>
          </div>
        </div>
      )
    }
    return <WorkspaceSetupPage configuredRoot={status.configuredRoot} onResolved={() => window.location.reload()} />
  }

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/content" element={<ContentPage />} />
            <Route path="/content/:id" element={<ContentDetailPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/queue" element={<RenderQueuePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/batch" element={<BatchRenderPage />} />
            <Route path="/agent" element={<AgentStudioPage />} />
            <Route path="/logs" element={<LogsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}