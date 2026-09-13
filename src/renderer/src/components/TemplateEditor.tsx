import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { LivePreview } from './LivePreview'
import { useTemplateEditor } from '@/hooks/useTemplateEditor'
import { Button } from '@/components/ui/Button'
import { Save, RotateCcw, Eye, Code } from 'lucide-react'

interface TemplateEditorProps {
  templateId: string
  onClose: () => void
}

export function TemplateEditor({ templateId, onClose }: TemplateEditorProps) {
  const {
    files, activeFile, setActiveFile, updateFile,
    save, saved, getPreviewHtml, reload
  } = useTemplateEditor(templateId)
  const [showPreview, setShowPreview] = useState(true)

  const fileLang: Record<string, string> = {
    html: 'html',
    css: 'css',
    json: 'json'
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">← Back</Button>
          <h2 className="text-sm font-semibold">{templateId}</h2>
          <div className="flex gap-1">
            {(['html', 'css', 'json'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActiveFile(f)}
                className={`rounded px-2 py-0.5 text-xs ${
                  activeFile === f ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(p => !p)}
            className="px-2 py-1 text-xs"
          >
            {showPreview ? <Eye className="h-3 w-3" /> : <Code className="h-3 w-3" />}
            {showPreview ? 'Preview' : 'Code'}
          </Button>
          <Button variant="ghost" size="icon" onClick={reload} className="h-7 w-7">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            onClick={save}
            disabled={saved}
            className="px-3 py-1 text-xs"
          >
            <Save className="h-3 w-3" />
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showPreview ? (
          <>
            <div className="w-1/2 border-r border-zinc-800">
              <Editor
                height="100%"
                language={fileLang[activeFile]}
                value={files[activeFile]}
                onChange={(v) => updateFile(activeFile, v || '')}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 12 }
                }}
              />
            </div>
            <div className="w-1/2">
              <LivePreview html={getPreviewHtml()} className="h-full" />
            </div>
          </>
        ) : (
          <div className="flex-1">
            <Editor
              height="100%"
              language={fileLang[activeFile]}
              value={files[activeFile]}
              onChange={(v) => updateFile(activeFile, v || '')}
              theme="vs-dark"
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12 }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
