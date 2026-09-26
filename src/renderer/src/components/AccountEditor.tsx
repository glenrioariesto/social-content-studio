import { useState, useEffect, useCallback } from 'react'
import { X, Upload, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import type { Account } from '@shared/index'

interface AccountEditorProps {
  /** Existing account id → edit mode; null → create mode. */
  account: Account | null
  onClose: () => void
  onSaved: () => void
}

/**
 * Create/Edit panel for account branding (FR-1/FR-2).
 * Logo is picked via a main-process native dialog (confined copy; the renderer
 * never supplies raw filesystem paths).
 */
export function AccountEditor({ account, onClose, onSaved }: AccountEditorProps) {
  const isEdit = account !== null
  const [name, setName] = useState(account?.name ?? '')
  const [description, setDescription] = useState(account?.description ?? '')
  const [replizId, setReplizId] = useState(account?.replizId ?? '')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load current logo preview (edit mode)
  const refreshLogo = useCallback(async () => {
    if (!account) return
    const res = await window.electron.account.getLogoUrl(account.id)
    setLogoUrl(res.success && res.data ? res.data : null)
  }, [account])
  useEffect(() => {
    void refreshLogo()
    
    // Feature Fix: Allow closing modal with Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [refreshLogo, onClose])

  const handleSetLogo = async () => {
    if (!account) {
      setError('Save the account first before uploading a logo.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await window.electron.account.setLogo(account.id)
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to upload logo')
      return
    }
    await refreshLogo()
    onSaved()
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (replizId.trim().length > 0 && !/^[A-Za-z0-9_-]{1,64}$/.test(replizId.trim())) {
      setError('Repliz ID must be 1-64 chars of letters, digits, _ or - (e.g. 680affa5ce12f2f72916f67e)')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isEdit && account) {
        const res = await window.electron.account.update(account.id, { name: name.trim(), description, replizId: replizId.trim() })
        if (!res.success) throw new Error(res.error ?? 'Failed to save')
      } else {
        const res = await window.electron.account.create({ name: name.trim(), description: description || undefined, replizId: replizId.trim() || undefined })
        if (!res.success) throw new Error(res.error ?? 'Failed to create')
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-zinc-100">{isEdit ? 'Edit Account' : 'New Account'}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                Account Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., JacksonLab"
                className={error?.includes('Name is required') ? 'border-red-500 focus:border-red-500' : ''}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">Description</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="A brief description of this brand or client."
              />
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-200">
                Repliz Integration ID
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Optional</span>
              </label>
              <p className="mb-3 text-xs leading-relaxed text-zinc-400">
                Connect this account to your Repliz profile. You can find your Account ID in your Repliz account settings.
              </p>
              <Input
                value={replizId}
                onChange={e => setReplizId(e.target.value)}
                placeholder="e.g., 680affa5ce12f2f72916f67e"
                spellCheck={false}
                className={`font-mono text-sm ${error?.includes('Repliz') ? 'border-red-500 focus:border-red-500' : ''}`}
              />
            </div>

            {/* Logo picker */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">Brand Logo</label>
              <div
                onClick={() => void handleSetLogo()}
                className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/30 p-6 text-center transition-all hover:border-indigo-500/50 hover:bg-zinc-800/50"
              >
                {logoUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={logoUrl} alt="Account logo" className="max-h-24 rounded shadow-sm object-contain" />
                    <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 group-hover:text-indigo-400 transition-colors">
                      <Upload className="h-3.5 w-3.5" /> Replace Logo
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="rounded-full bg-zinc-800 p-3 group-hover:bg-indigo-500/10 transition-colors">
                      <ImageIcon className="h-6 w-6 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-300 group-hover:text-indigo-300">
                        Click to upload a logo
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">PNG, JPG, WEBP, or SVG (max 5 MB)</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <div className="flex items-center">
            {saving && (
              <p className="flex items-center gap-2 text-sm font-medium text-indigo-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving changes…
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} disabled={saving} className="text-zinc-300 hover:text-white">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
              {isEdit ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
