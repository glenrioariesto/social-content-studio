import { useState, useEffect } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTemplates } from '@/hooks/useTemplates'
import { X, ArrowLeft, ArrowRight, Check, Sparkles, AlertCircle, Wand2, Loader2, Info } from 'lucide-react'
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

const WORKFLOW_DESCRIPTIONS: Record<WorkflowType, string> = {
  'manual-video': 'Upload your own local video file to process.',
  'internet-video': 'Download and process a video from a URL.',
  'product-video': 'Select a product and use its associated video.'
}

interface WizardData {
  accountId: string | null
  workflow: WorkflowType | null
  title: string
  description: string
  caption: string
  hashtags: string
}

const STEP_LABELS = [
  'Account Selection',
  'Source Type',
  'Content Details',
  'Review & Create'
]

export function ContentCreationWizard({ onClose }: ContentCreationWizardProps) {
  const { templates } = useTemplates()
  const [isCreating, setIsCreating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({
    accountId: null,
    workflow: null,
    title: '',
    description: '',
    caption: '',
    hashtags: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const { accounts } = useAccounts()
  const { showSuccess, showError, showInfo } = useErrorToast()

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const selectedAccount = accounts.find(a => a.id === data.accountId)
  const availableWorkflows = selectedAccount?.workflows || []

  const validateStep = () => {
    const newErrors: Record<string, string> = {}
    if (step === 1 && !data.accountId) {
      newErrors.accountId = 'Please select an account to continue.'
    }
    if (step === 2 && !data.workflow) {
      newErrors.workflow = 'Please select a resource source to continue.'
    }
    if (step === 3 && !data.title.trim()) {
      newErrors.title = 'Title is required.'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep()) {
      setStep(s => s + 1)
    }
  }

  const handleGenerateAI = async () => {
    if (!data.title.trim()) {
      setErrors({ title: 'Please enter a title first so the AI knows what to generate.' })
      return
    }
    
    setIsGenerating(true)
    setErrors({})
    try {
      const ai = window.electron.ai as unknown as {
        generateMetadata: (title: string) => Promise<{ description: string, caption: string, hashtags: string } | null>
      }
      const result = await ai.generateMetadata(data.title)
      if (result) {
        setData(d => ({
          ...d,
          description: result.description || d.description,
          caption: result.caption || d.caption,
          hashtags: result.hashtags || d.hashtags
        }))
        showSuccess('AI generation complete!')
      } else {
        showError('Failed to generate metadata with AI.')
      }
    } catch (e) {
      showError('An error occurred during AI generation.')
    } finally {
      setIsGenerating(false)
    }
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
      showSuccess('Content created successfully!')
      onClose()
    } else {
      showError('Failed to create content.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-0 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-zinc-800/50 bg-zinc-900/50 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Create New Content</h2>
            <p className="text-sm text-zinc-400 mt-1">{STEP_LABELS[step - 1]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="bg-zinc-900/30 px-6 py-4 border-b border-zinc-800/50">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  s < step ? 'bg-indigo-600' : s === step ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-xs font-medium text-indigo-400">Step {step} of 4</p>
            <p className="text-xs text-zinc-500">{(step / 4 * 100).toFixed(0)}% Complete</p>
          </div>
        </div>

        <div className="px-6 py-6 overflow-y-auto flex-1 custom-scrollbar">
          {step === 1 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-3 text-sm text-zinc-400 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <p>Select the target account for this content. The account determines which workflows and templates are available.</p>
              </div>
              
              {errors.accountId && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-900/50">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errors.accountId}
                </div>
              )}

              <div className="grid gap-3 mt-4">
                {accounts.map(account => (
                  <button
                    key={account.id}
                    onClick={() => {
                      setData(d => ({ ...d, accountId: account.id, workflow: null }))
                      setErrors({})
                    }}
                    className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${
                      data.accountId === account.id
                        ? 'border-indigo-500 bg-indigo-950/30 shadow-[0_0_15px_rgba(99,102,241,0.1)] ring-1 ring-indigo-500'
                        : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-lg transition-colors ${
                      data.accountId === account.id ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {account.name.charAt(0)}
                    </div>
                    <div>
                      <p className={`font-semibold ${data.accountId === account.id ? 'text-indigo-100' : 'text-zinc-200'}`}>
                        {account.name}
                      </p>
                      <p className="text-sm text-zinc-500">{account.workflows.length} available workflows</p>
                    </div>
                    {data.accountId === account.id && (
                      <Check className="ml-auto h-5 w-5 text-indigo-500" />
                    )}
                  </button>
                ))}
                {accounts.length === 0 && (
                  <div className="text-center py-8 text-zinc-500">
                    No accounts found. Please create an account first.
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-3 text-sm text-zinc-400 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <p>Choose how you want to source the media for this content. This will set up the correct processing pipeline.</p>
              </div>

              {errors.workflow && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-900/50">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errors.workflow}
                </div>
              )}

              <div className="grid gap-3 mt-4">
                {availableWorkflows.map(workflow => (
                  <button
                    key={workflow}
                    onClick={() => {
                      setData(d => ({ ...d, workflow }))
                      setErrors({})
                    }}
                    className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${
                      data.workflow === workflow
                        ? 'border-indigo-500 bg-indigo-950/30 shadow-[0_0_15px_rgba(99,102,241,0.1)] ring-1 ring-indigo-500'
                        : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg transition-colors ${
                      data.workflow === workflow ? 'bg-indigo-600' : 'bg-zinc-800'
                    }`}>
                      {workflow === 'manual-video' ? '📁' : workflow === 'internet-video' ? '🌐' : '📦'}
                    </div>
                    <div>
                      <p className={`font-semibold ${data.workflow === workflow ? 'text-indigo-100' : 'text-zinc-200'}`}>
                        {WORKFLOW_LABELS[workflow]}
                      </p>
                      <p className="text-sm text-zinc-500">{WORKFLOW_DESCRIPTIONS[workflow]}</p>
                    </div>
                    {data.workflow === workflow && (
                      <Check className="ml-auto h-5 w-5 text-indigo-500" />
                    )}
                  </button>
                ))}
                {availableWorkflows.length === 0 && (
                  <div className="text-center py-8 text-zinc-500">
                    No workflows available for this account.
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-xl">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-indigo-200">AI Metadata Generation</p>
                    <p className="text-xs text-indigo-300/70">Enter a title and let AI write the rest for you.</p>
                  </div>
                </div>
                <Button 
                  onClick={handleGenerateAI} 
                  disabled={isGenerating || !data.title.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 shadow-lg shadow-indigo-900/20"
                  size="sm"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-2" /> Auto-Generate</>
                  )}
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-300">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="text"
                    value={data.title}
                    onChange={e => {
                      setData(d => ({ ...d, title: e.target.value }))
                      if (errors.title) setErrors(e => ({ ...e, title: '' }))
                    }}
                    placeholder="e.g., Top 5 AI Tools in 2024"
                    className={`bg-zinc-900/50 ${errors.title ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {errors.title && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {errors.title}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Description</label>
                  <Textarea
                    value={data.description}
                    onChange={e => setData(d => ({ ...d, description: e.target.value }))}
                    placeholder="Brief description for internal organization..."
                    rows={2}
                    className="bg-zinc-900/50 resize-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-zinc-300">
                    <span>Social Caption</span>
                    <span className="text-xs font-normal text-zinc-500">Will be used for AI template matching</span>
                  </label>
                  <Textarea
                    value={data.caption}
                    onChange={e => setData(d => ({ ...d, caption: e.target.value }))}
                    placeholder="Engaging caption for your social media post..."
                    rows={3}
                    className="bg-zinc-900/50 resize-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Hashtags</label>
                  <Input
                    type="text"
                    value={data.hashtags}
                    onChange={e => setData(d => ({ ...d, hashtags: e.target.value }))}
                    placeholder="e.g., #tech, #ai, #innovation (comma separated)"
                    className="bg-zinc-900/50"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 text-sm text-green-400 bg-green-950/20 p-4 rounded-xl border border-green-900/50">
                <Check className="w-5 h-5 shrink-0" />
                <p>You're all set! Review the details below before creating the content.</p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                <div className="grid grid-cols-3 gap-2 border-b border-zinc-800/50 pb-4">
                  <span className="text-sm font-medium text-zinc-500">Target Account</span>
                  <span className="col-span-2 text-sm font-medium text-zinc-200 flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                      {selectedAccount?.name.charAt(0)}
                    </div>
                    {selectedAccount?.name}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 border-b border-zinc-800/50 pb-4">
                  <span className="text-sm font-medium text-zinc-500">Source Type</span>
                  <span className="col-span-2 text-sm text-zinc-200">
                    {data.workflow ? WORKFLOW_LABELS[data.workflow] : '-'}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 border-b border-zinc-800/50 pb-4">
                  <span className="text-sm font-medium text-zinc-500">Title</span>
                  <span className="col-span-2 text-sm text-zinc-200 font-semibold">{data.title}</span>
                </div>
                
                {data.description && (
                  <div className="grid grid-cols-3 gap-2 border-b border-zinc-800/50 pb-4">
                    <span className="text-sm font-medium text-zinc-500">Description</span>
                    <span className="col-span-2 text-sm text-zinc-300">{data.description}</span>
                  </div>
                )}
                
                {data.caption && (
                  <div className="grid grid-cols-3 gap-2 border-b border-zinc-800/50 pb-4">
                    <span className="text-sm font-medium text-zinc-500">Caption</span>
                    <span className="col-span-2 text-sm text-zinc-300 whitespace-pre-wrap">{data.caption}</span>
                  </div>
                )}
                
                {data.hashtags && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm font-medium text-zinc-500">Hashtags</span>
                    <span className="col-span-2 flex flex-wrap gap-1.5">
                      {data.hashtags.split(',').map(h => h.trim()).filter(Boolean).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-indigo-950/40 text-indigo-300 text-xs border border-indigo-500/20">
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex items-start gap-3 text-xs text-zinc-500 bg-zinc-900/30 p-3 rounded-lg">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
                <p>Content will be created with an "Idea" status. You can upload media resources and refine the template selection later in the editor.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800/50 bg-zinc-900/50 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step > 1 ? 'Previous Step' : 'Cancel'}
          </Button>

          {step < 4 ? (
            <Button 
              onClick={handleNext}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 shadow-md shadow-indigo-900/20"
            >
              Next Step
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleCreate} 
              disabled={isCreating}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 shadow-lg shadow-indigo-900/30 relative overflow-hidden group"
            >
              {isCreating ? (
                <span className="flex items-center gap-2 relative z-10">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="animate-pulse">AI is thinking & finalizing...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 relative z-10">
                  <Check className="h-4 w-4" /> 
                  Create Content
                </span>
              )}
              {!isCreating && (
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
