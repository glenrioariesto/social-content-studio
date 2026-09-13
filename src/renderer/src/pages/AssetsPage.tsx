import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, Image, Music, Film, Type, Trash2 } from 'lucide-react'
import { useErrorToast } from '@/hooks/useErrorToast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'

interface AssetList {
  images: string[]
  audio: string[]
  video: string[]
  fonts: string[]
}

const TABS = [
  { key: 'images', label: 'Images', icon: Image },
  { key: 'audio', label: 'Audio', icon: Music },
  { key: 'video', label: 'Video', icon: Film },
  { key: 'fonts', label: 'Fonts', icon: Type }
] as const

export function AssetsPage() {
  const [assets, setAssets] = useState<AssetList>({ images: [], audio: [], video: [], fonts: [] })
  const [activeTab, setActiveTab] = useState<keyof AssetList>('images')
  const [loading, setLoading] = useState(false)
  const { showSuccess } = useErrorToast()

  const loadAssets = useCallback(async () => {
    setLoading(true)
    const result = await window.electron.workspace.getAssets()
    if (result.success && result.data) {
      setAssets(result.data as unknown as AssetList)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAssets() }, [loadAssets])

  const handleUpload = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = async () => {
      if (!input.files) return
      for (const file of Array.from(input.files)) {
        const reader = new FileReader()
        reader.onload = async () => {
          const ext = file.name.split('.').pop() || ''
          let folder = 'images'
          if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) folder = 'audio'
          else if (['mp4', 'webm', 'avi', 'mov'].includes(ext)) folder = 'video'
          else if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) folder = 'fonts'

          await window.electron.fs.writeFile(`workspace/assets/${folder}/${file.name}`, reader.result as string)
          await loadAssets()
        }
        reader.readAsDataURL(file)
      }
      showSuccess(`Uploaded ${input.files.length} file(s)`)
    }
    input.click()
  }

  const handleDelete = async (folder: string, fileName: string) => {
    await window.electron.fs.rm(`workspace/assets/${folder}/${fileName}`)
    await loadAssets()
    showSuccess(`Deleted ${fileName}`)
  }

  const currentAssets = assets[activeTab] || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="mt-1 text-sm text-zinc-400">Images, audio, video, and fonts</p>
        </div>
        <Button onClick={handleUpload}>+ Upload</Button>
      </div>

      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map(tab => {
          const Icon = tab.icon
          const count = assets[tab.key]?.length || 0
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px]">{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <LoadingState label="Loading assets..." />
      ) : currentAssets.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-10 w-10" />} title={`No ${activeTab} yet`} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {currentAssets.map(name => (
            <Card key={name} className="group p-3 transition-all hover:border-zinc-600">
              <div className="mb-2 aspect-square rounded-lg bg-zinc-800/50 flex items-center justify-center">
                {activeTab === 'images' ? (
                  <img
                    src={`workspace/assets/images/${name}`}
                    alt={name}
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <FolderOpen className="h-6 w-6 text-zinc-700" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="truncate text-xs text-zinc-400">{name}</p>
                <button
                  onClick={() => handleDelete(activeTab, name)}
                  className="rounded p-1 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
