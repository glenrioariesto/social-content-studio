import { useState } from 'react'
import { useTemplates } from '@/hooks/useTemplates'
import { useAccounts } from '@/hooks/useAccounts'
import { TemplateEditor } from '@/components/TemplateEditor'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Field'
import { Select } from '@/components/ui/Field'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Plus, Trash2, Layers } from 'lucide-react'
import type { TemplateDefinition } from '@shared/template'
import type { TemplateType } from '@shared/index'

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
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<TemplateType>('html-template')
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
        <Button onClick={() => setShowCreate(true)}>+ New Template</Button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/20 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">New Template</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Name</label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g., JacksonLab News"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Type</label>
              <Select value={newType} onChange={e => setNewType(e.target.value as TemplateType)}>
                {TEMPLATE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Account</label>
              <Select value={newAccount} onChange={e => setNewAccount(e.target.value)}>
                <option value="">None</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">
            Available variables: <code className="text-zinc-400">{'{{account.name}}'}</code>, <code className="text-zinc-400">{'{{account.description}}'}</code>, <code className="text-zinc-400">{'{{account.logo}}'}</code> — replaced with the bound account's branding during composition.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleCreate}>Create</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading templates..." />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-10 w-10" />}
          title="No templates yet. Create your first template!"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card
              key={template.id}
              className="group p-4 transition-all hover:border-zinc-600"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{template.name}</h3>
                  <p className="text-xs text-zinc-500">{template.type}</p>
                </div>
                <Button
                  onClick={() => setPendingDelete(template.id)}
                  className="rounded p-1 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-transparent hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mb-3 aspect-[9/16] overflow-hidden rounded-lg bg-zinc-800/50">
                <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                  {template.output?.width}×{template.output?.height}
                </div>
              </div>

              {template.accountId && (
                <p className="mb-2 text-[10px] text-zinc-600">Account: {template.accountId}</p>
              )}

              <Button variant="outline" className="w-full text-xs" onClick={() => setEditingId(template.id)}>
                Open Editor
              </Button>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete template"
        description={`Delete "${templates.find(t => t.id === pendingDelete)?.name ?? 'this template'}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (pendingDelete) await deleteTemplate(pendingDelete)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
