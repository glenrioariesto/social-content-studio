import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Upload, Image as ImageIcon, Loader2 } from 'lucide-react'
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
 * Logo can be set via native file dialog OR drag-and-drop (both resolve to an
 * absolute path handed to the main process for a confined copy).
 */
export function AccountEditor({ account, onClose, onSaved }: AccountEditorProps) {
  const isEdit = account !== null
  const [name, setName] = useState(account?.name ?? '')
  const [description, setDescription] = useState(account?.description ?? '')
  const [replizId, setReplizId] = useState(account?.replizId ?? '')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load current logo preview (edit mode)
  const refreshLogo = useCallback(async () => {
    if (!account) return
    const res = await window.electron.account.getLogoUrl(account.id)
    setLogoUrl(res.success && res.data ? res.data : null)
  }, [account])

  useEffect(() => {
    void refreshLogo()
  }, [refreshLogo])

  const handleLogoPath = async (sourcePath: string | undefined) => {
    if (!sourcePath || !account) {
      if (!account) setError('Save the account first before uploading a logo.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await window.electron.account.setLogo(account.id, sourcePath)
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to upload logo')
      return
    }
    await refreshLogo()
    onSaved()
  }

  const handleChooseFile = async () => {
    // Electron: <input type="file"> yields File objects with .path
    fileInputRef.current?.click()
  }

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] as (File & { path?: string }) | undefined
    await handleLogoPath(f?.path)
    e.target.value = ''
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    const path = (f as (File & { path?: string }) | undefined)?.path
    if (!path) {
      setError('Could not read the dropped file path. Try "Choose logo…" instead.')
      return
    }
    await handleLogoPath(path)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">{isEdit ? 'Edit Account' : 'New Account'}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="rounded p-1 text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Name *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., JacksonLab"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Short brand description used via {{account.description}}"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Repliz Account ID</label>
            <Input
              value={replizId}
              onChange={e => setReplizId(e.target.value)}
              placeholder="e.g., 680affa5ce12f2f72916f67e"
              spellCheck={false}
              className="font-mono text-sm"
            />
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
              Optional. Repliz GET /public/account/{'{accountId}'}. Only stored locally; never sent anywhere by this app.
            </p>
          </div>

          {/* Logo drop zone */}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Logo</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={handleChooseFile}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? 'border-indigo-500 bg-indigo-950/30' : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600'
              }`}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Account logo" className="max-h-20 rounded object-contain" />
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-zinc-600" />
                  <p className="text-xs text-zinc-500">
                    Drag &amp; drop an image here, or click to browse
                  </p>
                  <p className="text-[10px] text-zinc-600">PNG · JPG · WEBP · SVG — max 5 MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg"
              className="hidden"
              onChange={onFileInputChange}
            />
            {logoUrl && (
              <button
                onClick={(e) => { e.stopPropagation(); void refreshLogo() }}
                className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                <Upload className="h-3 w-3" /> Replace logo (click the box above or drop a new file)
              </button>
            )}
          </div>
        </div>

        {saving && (
          <p className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {isEdit ? 'Save changes' : 'Create account'}
          </Button>
        </div>
      </div>
    </div>
  )
}
