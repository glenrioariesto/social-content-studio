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

export function App() {
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
            <Route path="/logs" element={<LogsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
