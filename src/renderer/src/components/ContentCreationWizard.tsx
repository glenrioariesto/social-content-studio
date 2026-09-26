import { useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTemplates } from '@/hooks/useTemplates'
import { X, ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { useErrorToast } from '@/hooks/useErrorToast'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import type { Account, WorkflowType } from '@shared/index'

interface ContentCreationWizardProps {
  onClose: () => void
}

const WORKFLOW_LABELS: Record<WorkflowType, string> = {
  'manual-video': 'Upload Video',
  'internet-video': 'Download from Internet',
  'product-video': 'Product Resource'
}

interface WizardData {
  accountId: string | null
  workflow: WorkflowType | null
  title: string
  description: string
  caption: string
  hashtags: string
}

export function ContentCreationWizard({ onClose }: ContentCreationWizardProps) {
  const { templates } = useTemplates()
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({
    accountId: null,
    workflow: null,
    title: '',
    description: '',
    caption: '',
    hashtags: ''
  })
  const { accounts } = useAccounts()
  const { showSuccess, showInfo } = useErrorToast()

  const selectedAccount = accounts.find(a => a.id === data.accountId)
  const availableWorkflows = selectedAccount?.workflows || []

  const canNext = () => {
    if (step === 1) return !!data.accountId
    if (step === 2) return !!data.workflow
    if (step === 3) return !!data.title.trim()
    return true
  }

  const handleCreate = async () => {
    setIsCreating(true)
    
    let templateId: string | undefined = undefined
    if (data.caption.trim() && templates.length > 0) {
      const available = templates.map(t => ({ id: t.id, name: t.name, type: t.type }))
      const suggestion = await window.electron.ai.suggestTemplate(data.caption, available)
      if (suggestion.success && suggestion.data) {
        templateId = suggestion.data
        showSuccess(`AI automatically selected template: ${templateId}`)
      }
    }

    const result = await window.electron.workspace.createContent({
      title: data.title,
      description: data.description,
      accountId: data.accountId,
      templateId,
      status: 'idea',
      caption: data.caption,
      hashtags: data.hashtags.split(',').map(h => h.trim()).filter(Boolean)
    })

    setIsCreating(false)
    if (result.success) {
      showSuccess('Content created!')
      onClose()
    } else {
      showInfo('Failed to create content')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold">New Content</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-6 py-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-indigo-600' : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Step {step} of 4</p>
        </div>

        <div className="px-6 py-6">
          {step === 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-300">Select Account</h3>
              {accounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => setData(d => ({ ...d, accountId: account.id, workflow: null }))}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    data.accountId === account.id
                      ? 'border-indigo-600/50 bg-indigo-950/20'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold">
                    {account.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-zinc-500">{account.workflows.length} workflows</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-300">Resource Source</h3>
              {availableWorkflows.map(workflow => (
                <button
                  key={workflow}
                  onClick={() => setData(d => ({ ...d, workflow }))}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    data.workflow === workflow
                      ? 'border-indigo-600/50 bg-indigo-950/20'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-xs">
                    {workflow === 'manual-video' ? '📁' : workflow === 'internet-video' ? '🌐' : '📦'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{WORKFLOW_LABELS[workflow]}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-300">Content Details</h3>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Title *</label>
                <Input
                  type="text"
                  value={data.title}
                  onChange={e => setData(d => ({ ...d, title: e.target.value }))}
                  placeholder="e.g., AI News Today"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Description</label>
                <Textarea
                  value={data.description}
                  onChange={e => setData(d => ({ ...d, description: e.target.value }))}
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Caption</label>
                <Textarea
                  value={data.caption}
                  onChange={e => setData(d => ({ ...d, caption: e.target.value }))}
                  placeholder="Caption for the post..."
                  rows={2}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Hashtags (comma separated)</label>
                <Input
                  type="text"
                  value={data.hashtags}
                  onChange={e => setData(d => ({ ...d, hashtags: e.target.value }))}
                  placeholder="#ai, #tech, #news"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-300">Review</h3>
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Account</span>
                  <span>{selectedAccount?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Source</span>
                  <span>{data.workflow ? WORKFLOW_LABELS[data.workflow] : '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Title</span>
                  <span>{data.title}</span>
                </div>
                {data.description && (
                  <div className="text-sm">
                    <span className="text-zinc-400">Description: </span>
                    <span>{data.description}</span>
                  </div>
                )}
                {data.hashtags && (
                  <div className="text-sm">
                    <span className="text-zinc-400">Hashtags: </span>
                    <span>{data.hashtags}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Content will be created with status "Idea". You can add resource and template later.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {step > 1 ? 'Back' : 'Cancel'}
          </Button>

          {step < 4 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={!canNext() || isCreating}>
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse" /> AI is thinking...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" /> Create Content
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
