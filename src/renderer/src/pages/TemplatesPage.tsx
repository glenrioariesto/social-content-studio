import { useState } from 'react'
import { useTemplates } from '@/hooks/useTemplates'
import { useAccounts } from '@/hooks/useAccounts'
import { TemplateEditor } from '@/components/TemplateEditor'
import { Plus, Trash2, Layers } from 'lucide-react'
import type { TemplateDefinition } from '@shared/template'

const TEMPLATE_TYPES = [
  { value: 'html-template', label: 'HTML Template' },
  { value: 'video-overlay', label: 'Video Overlay' },
  { value: 'image-overlay', label: 'Image Overlay' },
  { value: 'ffmpeg-composition', label: 'FFmpeg Composition' }
]

export function TemplatesPage() {
  const { templates, loading, createTemplate, deleteTemplate } = useTemplates()
  const { accounts } = useAccounts()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('html-template')
  const [newAccount, setNewAccount] = useState('')

  if (editingId) {
    return <TemplateEditor templateId={editingId} onClose={() => setEditingId(null)} />
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    const id = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const template: TemplateDefinition = {
      id,
      name: newName,
      type: newType,
      accountId: newAccount || undefined,
      input: { type: 'html' },
      output: { width: 1080, height: 1920, fps: 30 },
      variables: []
    }
    await createTemplate(template)
    setShowCreate(false)
    setNewName('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage content templates and overlays</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          + New Template
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/20 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">New Template</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g., JacksonLab News"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Type</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                {TEMPLATE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Account</label>
              <select
                value={newAccount}
                onChange={e => setNewAccount(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="">None</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">
            Available variables: <code className="text-zinc-400">{'{{account.name}}'}</code>, <code className="text-zinc-400">{'{{account.description}}'}</code>, <code className="text-zinc-400">{'{{account.logo}}'}</code> — replaced with the bound account's branding during composition.
          </p>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-zinc-500">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Layers className="mb-3 h-10 w-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">No templates yet. Create your first template!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <div
              key={template.id}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-600"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{template.name}</h3>
                  <p className="text-xs text-zinc-500">{template.type}</p>
                </div>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  className="rounded p-1 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mb-3 aspect-[9/16] overflow-hidden rounded-lg bg-zinc-800/50">
                <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                  {template.output?.width}×{template.output?.height}
                </div>
              </div>

              {template.accountId && (
                <p className="mb-2 text-[10px] text-zinc-600">Account: {template.accountId}</p>
              )}

              <button
                onClick={() => setEditingId(template.id)}
                className="w-full rounded-lg border border-zinc-700 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
              >
                Open Editor
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
