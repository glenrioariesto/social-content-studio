import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  FolderOpen,
  Image as ImageIcon,
  Music,
  Film,
  Type,
  Trash2,
  Upload,
  UploadCloud,
  Search,
  X,
  Folder,
  RefreshCw,
  LayoutGrid,
  List,
  ImageOff,
  Eye,
  Loader2,
  Play
} from 'lucide-react'
import { useErrorToast } from '@/hooks/useErrorToast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Modal } from '@/components/ui/Modal'

interface AssetList {
  images: string[]
  audio: string[]
  video: string[]
  fonts: string[]
}

const TABS = [
  { key: 'images', label: 'Images', icon: ImageIcon, color: 'text-indigo-400' },
  { key: 'audio', label: 'Audio', icon: Music, color: 'text-purple-400' },
  { key: 'video', label: 'Video', icon: Film, color: 'text-cyan-400' },
  { key: 'fonts', label: 'Fonts', icon: Type, color: 'text-amber-400' }
] as const

const TAB_DESCRIPTIONS: Record<keyof AssetList, { title: string; desc: string; accept: string }> = {
  images: {
    title: 'No image assets found',
    desc: 'Upload PNG, JPG, WebP, or SVG images for thumbnails, background cards, and overlays.',
    accept: 'image/*'
  },
  audio: {
    title: 'No audio tracks found',
    desc: 'Upload MP3, WAV, or AAC audio files for background music, voiceovers, and sound effects.',
    accept: 'audio/*'
  },
  video: {
    title: 'No video clips found',
    desc: 'Upload MP4 or WebM video footage for reels, background loops, and video overlays.',
    accept: 'video/*'
  },
  fonts: {
    title: 'No custom fonts found',
    desc: 'Upload TTF, OTF, or WOFF fonts to customize captions, titles, and text layers.',
    accept: '.ttf,.otf,.woff,.woff2'
  }
}

function unwrapBase64Url(dataUrl: string): string {
  if (!dataUrl.startsWith('data:image/')) return dataUrl
  try {
    const raw = atob(dataUrl.split(',')[1] || '')
    if (raw.startsWith('data:image/')) {
      return raw
    }
  } catch {
    // Keep original if atob fails
  }
  return dataUrl
}

function AssetImage({ name }: { name: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(false)
    window.electron.fs
      .readImageBase64(`workspace/assets/images/${name}`)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) {
          setUrl(unwrapBase64Url(res.data))
        } else {
          setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [name])

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg bg-zinc-800/40 p-3 text-zinc-500">
        <ImageOff className="h-6 w-6 text-zinc-600" />
        <span className="text-[10px] text-zinc-500">Preview unavailable</span>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-zinc-800/60 animate-pulse">
        <ImageIcon className="h-6 w-6 text-zinc-700 animate-pulse" />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={name}
      loading="lazy"
      className="h-full w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
      onError={() => setError(true)}
    />
  )
}

function ImagePreviewModal({
  name,
  onClose
}: {
  name: string | null
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!name) {
      setUrl(null)
      return
    }
    setLoading(true)
    setError(false)
    window.electron.fs
      .readImageBase64(`workspace/assets/images/${name}`)
      .then((res) => {
        if (res.success && res.data) {
          setUrl(unwrapBase64Url(res.data))
        } else {
          setError(true)
        }
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [name])

  return (
    <Modal open={name !== null} onClose={onClose} title={name || 'Image Preview'} className="max-w-2xl">
      <div className="p-4 flex flex-col items-center">
        <div className="w-full min-h-[260px] max-h-[60vh] overflow-hidden rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-800">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400 py-16">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              <span>Loading preview...</span>
            </div>
          ) : error || !url ? (
            <div className="flex flex-col items-center gap-2 text-zinc-500 py-16">
              <ImageOff className="h-8 w-8 text-zinc-600" />
              <span className="text-sm">Unable to render preview</span>
            </div>
          ) : (
            <img src={url} alt={name ?? ''} className="max-h-[58vh] max-w-full object-contain p-2" />
          )}
        </div>
        <div className="mt-4 flex w-full items-center justify-between">
          <p className="truncate text-xs text-zinc-400 max-w-md" title={name ?? ''}>
            {name}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (name) {
                  window.electron.fs.showInFolder(`workspace/assets/images/${name}`)
                }
              }}
            >
              <Folder className="h-3.5 w-3.5 mr-1.5" />
              Show in folder
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function AssetsPage() {
  const [assets, setAssets] = useState<AssetList>({ images: [], audio: [], video: [], fonts: [] })
  const [activeTab, setActiveTab] = useState<keyof AssetList>('images')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ folder: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Drag and drop & upload states
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
    filename: string
  } | null>(null)

  const dragCounter = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showSuccess, showError } = useErrorToast()

  const loadAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await window.electron.workspace.getAssets()
    if (result.success && result.data) {
      setAssets(result.data as unknown as AssetList)
    } else {
      setError(result.error ?? 'Failed to load assets')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || uploading) return
    setUploading(true)
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadProgress({ current: i + 1, total: files.length, filename: file.name })

      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        let folder: keyof AssetList = activeTab

        // Try AI category classification, fall back to heuristics
        try {
          const aiCategory = await window.electron.ai.classifyAsset(file.name)
          if (
            aiCategory?.success &&
            aiCategory.data &&
            ['images', 'audio', 'video', 'fonts'].includes(aiCategory.data)
          ) {
            folder = aiCategory.data as keyof AssetList
          } else {
            if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)) folder = 'audio'
            else if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext)) folder = 'video'
            else if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) folder = 'fonts'
            else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext)) folder = 'images'
          }
        } catch {
          if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)) folder = 'audio'
          else if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext)) folder = 'video'
          else if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) folder = 'fonts'
          else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext)) folder = 'images'
        }

        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        })

        const writeRes = await window.electron.fs.writeFile(
          `workspace/assets/${folder}/${file.name}`,
          content
        )
        if (writeRes.success) {
          successCount++
        } else {
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    setUploading(false)
    setUploadProgress(null)
    await loadAssets()

    if (successCount > 0 && errorCount === 0) {
      showSuccess(`Uploaded ${successCount} asset${successCount > 1 ? 's' : ''}`)
    } else if (successCount > 0 && errorCount > 0) {
      showSuccess(`Uploaded ${successCount} asset(s), but ${errorCount} failed`)
    } else if (errorCount > 0) {
      showError(`Failed to upload ${errorCount} file(s)`)
    }
  }

  const handlePickFiles = (acceptType?: string) => {
    if (!fileInputRef.current) return
    fileInputRef.current.accept = acceptType ?? ''
    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    await uploadFiles(files)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      const res = await window.electron.fs.rm(
        `workspace/assets/${pendingDelete.folder}/${pendingDelete.name}`
      )
      if (res.success) {
        showSuccess(`Deleted ${pendingDelete.name}`)
        await loadAssets()
      } else {
        showError(res.error ?? `Failed to delete ${pendingDelete.name}`)
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsDeleting(false)
      setPendingDelete(null)
    }
  }

  const handleShowInFolder = async (folder: string, name: string) => {
    try {
      const res = await window.electron.fs.showInFolder(`workspace/assets/${folder}/${name}`)
      if (!res.success) {
        showError(res.error ?? 'Could not reveal file in folder')
      }
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Could not reveal file in folder')
    }
  }

  const currentAssets = assets[activeTab] || []

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return currentAssets
    return currentAssets.filter((name) => name.toLowerCase().includes(q))
  }, [currentAssets, searchQuery])

  const totalAssetsCount =
    (assets.images?.length || 0) +
    (assets.audio?.length || 0) +
    (assets.video?.length || 0) +
    (assets.fonts?.length || 0)

  return (
    <div
      className="relative min-h-[80vh] space-y-6"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-indigo-500 bg-zinc-900/90 p-8 text-center shadow-2xl">
            <div className="rounded-full bg-indigo-500/10 p-4 text-indigo-400">
              <UploadCloud className="h-10 w-10 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Drop files to upload</h3>
              <p className="mt-1 text-xs text-zinc-400">
                Media files will be automatically organized into Images, Audio, Video, or Fonts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Assets</h1>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {totalAssetsCount} item{totalAssetsCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Manage media files, audio clips, video reels, and brand fonts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadAssets()}
            disabled={loading || uploading}
            title="Refresh assets"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => handlePickFiles()} disabled={uploading}>
            <Upload className="mr-1.5 h-4 w-4" />
            Upload Assets
          </Button>
        </div>
      </div>

      {/* Upload Zone / Progress Banner */}
      {uploading ? (
        <div className="flex flex-col gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  Uploading {uploadProgress?.filename ? `"${uploadProgress.filename}"` : 'files'}...
                </p>
                <p className="text-xs text-zinc-400">
                  {uploadProgress?.current ?? 0} of {uploadProgress?.total ?? 0} file(s) processed
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-indigo-300">
              {uploadProgress
                ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{
                width: `${
                  uploadProgress
                    ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
                    : 0
                }%`
              }}
            />
          </div>
        </div>
      ) : (
        <div
          onClick={() => handlePickFiles()}
          className="group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/40 px-6 py-4 text-center transition-all hover:border-indigo-500 hover:bg-indigo-950/10"
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="rounded-lg bg-zinc-800 p-2 text-zinc-400 transition-colors group-hover:bg-indigo-600/20 group-hover:text-indigo-400">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-zinc-300 transition-colors group-hover:text-white">
                Drag and drop files here, or{' '}
                <span className="text-indigo-400 underline decoration-indigo-500/30 underline-offset-2">
                  browse files
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                Supports PNG, JPG, WebP, SVG, MP4, MP3, WAV, TTF, WOFF • Auto-sorted by AI
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const count = assets[tab.key]?.length || 0
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? tab.color : 'text-zinc-500'}`} />
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  isActive ? 'bg-indigo-950 text-indigo-300' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search & View Mode Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${activeTab}...`}
            className="h-8 border-zinc-800 bg-zinc-900/60 pl-8 pr-8 text-xs text-zinc-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-zinc-500">
            {filteredAssets.length} of {currentAssets.length} file
            {currentAssets.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded p-1.5 transition-colors ${
                viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState label="Loading assets..." />
      ) : error ? (
        <ErrorState
          title="Failed to load assets"
          message={error}
          onRetry={() => void loadAssets()}
        />
      ) : currentAssets.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={
            activeTab === 'images' ? (
              <ImageIcon className="h-10 w-10 text-indigo-400/80" />
            ) : activeTab === 'audio' ? (
              <Music className="h-10 w-10 text-purple-400/80" />
            ) : activeTab === 'video' ? (
              <Film className="h-10 w-10 text-cyan-400/80" />
            ) : (
              <Type className="h-10 w-10 text-amber-400/80" />
            )
          }
          title={TAB_DESCRIPTIONS[activeTab].title}
          description={TAB_DESCRIPTIONS[activeTab].desc}
          action={
            <Button
              onClick={() => handlePickFiles(TAB_DESCRIPTIONS[activeTab].accept)}
              className="mt-2"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Upload {TABS.find((t) => t.key === activeTab)?.label}
            </Button>
          }
        />
      ) : filteredAssets.length === 0 ? (
        /* No Search Matches */
        <EmptyState
          icon={<Search className="h-8 w-8 text-zinc-600" />}
          title={`No ${activeTab} match "${searchQuery}"`}
          description="Try checking for typos or searching with a different term."
          action={
            <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          }
        />
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredAssets.map((name) => {
            const ext = name.split('.').pop()?.toUpperCase() || ''
            return (
              <Card
                key={name}
                className="group relative flex flex-col justify-between border-zinc-800/80 bg-zinc-900/60 p-2.5 transition-all hover:border-zinc-700 hover:shadow-lg"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-800/40">
                  {activeTab === 'images' ? (
                    <AssetImage name={name} />
                  ) : activeTab === 'audio' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-purple-950/30 via-zinc-900 to-zinc-900 p-3">
                      <div className="mb-2 rounded-full bg-purple-500/10 p-2.5 text-purple-400">
                        <Music className="h-6 w-6" />
                      </div>
                      <div className="flex h-5 items-end gap-0.5">
                        {[40, 70, 30, 90, 60, 100, 45, 80, 55, 95, 35].map((h, i) => (
                          <span
                            key={i}
                            className="w-1 rounded-full bg-purple-400/40"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                      <span className="mt-2 rounded border border-purple-800/40 bg-purple-950/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-purple-300">
                        {ext || 'AUDIO'}
                      </span>
                    </div>
                  ) : activeTab === 'video' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-cyan-950/30 via-zinc-900 to-zinc-900 p-3">
                      <div className="mb-2 rounded-full bg-cyan-500/10 p-2.5 text-cyan-400">
                        <Film className="h-6 w-6" />
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs text-cyan-400/80">
                        <Play className="h-3 w-3 fill-cyan-400/40 text-cyan-400" />
                        <span>VIDEO</span>
                      </div>
                      <span className="mt-2 rounded border border-cyan-800/40 bg-cyan-950/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-cyan-300">
                        {ext || 'VIDEO'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-950/30 via-zinc-900 to-zinc-900 p-3">
                      <span className="font-serif text-3xl font-bold tracking-widest text-amber-200/80">
                        Aa
                      </span>
                      <p className="mt-1 max-w-[90%] truncate text-[10px] text-zinc-500">
                        {name.replace(/\.[^/.]+$/, '')}
                      </p>
                      <span className="mt-2 rounded border border-amber-800/40 bg-amber-950/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-300">
                        {ext || 'FONT'}
                      </span>
                    </div>
                  )}

                  {/* Hover Quick Action Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100">
                    {activeTab === 'images' && (
                      <button
                        onClick={() => setPreviewImage(name)}
                        className="rounded-lg bg-zinc-800/90 p-2 text-zinc-200 shadow transition-colors hover:bg-indigo-600 hover:text-white"
                        title="Preview image"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleShowInFolder(activeTab, name)}
                      className="rounded-lg bg-zinc-800/90 p-2 text-zinc-200 shadow transition-colors hover:bg-indigo-600 hover:text-white"
                      title="Show in folder"
                    >
                      <Folder className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setPendingDelete({ folder: activeTab, name })}
                      className="rounded-lg bg-zinc-800/90 p-2 text-zinc-200 shadow transition-colors hover:bg-red-600 hover:text-white"
                      title="Delete asset"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-2 flex items-center justify-between gap-1.5 px-0.5">
                  <p
                    className="truncate text-xs font-medium text-zinc-300 group-hover:text-zinc-100"
                    title={name}
                  >
                    {name}
                  </p>
                  <span className="shrink-0 rounded bg-zinc-800 px-1 py-0.5 font-mono text-[9px] uppercase text-zinc-500">
                    {ext}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 divide-y divide-zinc-800/60">
          {filteredAssets.map((name) => {
            const ext = name.split('.').pop()?.toUpperCase() || ''
            const tabMeta = TABS.find((t) => t.key === activeTab)
            const Icon = tabMeta?.icon || FolderOpen
            return (
              <div
                key={name}
                className="group flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-zinc-800/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-lg bg-zinc-800/80 p-2 text-zinc-400 group-hover:text-zinc-200">
                    <Icon className={`h-4 w-4 ${tabMeta?.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate text-xs font-medium text-zinc-200 group-hover:text-white"
                      title={name}
                    >
                      {name}
                    </p>
                    <p className="font-mono text-[10px] uppercase text-zinc-500">
                      {ext} • {activeTab}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {activeTab === 'images' && (
                    <button
                      onClick={() => setPreviewImage(name)}
                      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                      title="Preview image"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleShowInFolder(activeTab, name)}
                    className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                    title="Show in folder"
                  >
                    <Folder className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPendingDelete({ folder: activeTab, name })}
                    className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-950/50 hover:text-red-400"
                    title="Delete asset"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      <ImagePreviewModal name={previewImage} onClose={() => setPreviewImage(null)} />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete asset"
        description={`Are you sure you want to delete "${pendingDelete?.name}"? This action permanently removes the file from the workspace.`}
        confirmLabel="Delete"
        busy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
