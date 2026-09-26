import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { LivePreview } from './LivePreview'
import { VisualTemplateBuilder } from './VisualTemplateBuilder'
import { useTemplateEditor } from '@/hooks/useTemplateEditor'
import { Button } from '@/components/ui/Button'
import { Save, RotateCcw, Eye, Code } from 'lucide-react'

interface TemplateEditorProps {
  templateId: string
  onClose: () => void
}

export function TemplateEditor({ templateId, onClose }: TemplateEditorProps) {
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'json' | 'visual'>('visual')
  const {
    files, activeFile, setActiveFile, updateFile,
    save, saved, getPreviewHtml, reload, previewAccountId, setPreviewAccountId, accounts
  } = useTemplateEditor(templateId)
  const [showPreview, setShowPreview] = useState(true)

  const fileLang: Record<string, string> = {
    html: 'html',
    css: 'css',
    json: 'json'
  }

  const renderMainArea = () => {
    if (activeTab === 'visual') {
      return (
        <VisualTemplateBuilder 
          jsonContent={files.json}
          onChange={(newHtml, newCss, newJson) => {
            updateFile('html', newHtml)
            updateFile('css', newCss)
            updateFile('json', newJson)
          }}
        />
      )
    }
    return (
      <Editor
        height="100%"
        language={fileLang[activeTab] || 'html'}
        value={files[activeTab as 'html'|'css'|'json']}
        onChange={(v) => updateFile(activeTab as 'html'|'css'|'json', v || '')}
        theme="vs-dark"
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 12 }
        }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">← Back</Button>
          <h2 className="text-sm font-semibold">{templateId}</h2>
          <div className="flex gap-1 bg-zinc-900 rounded p-0.5 border border-zinc-800">
            {(['visual', 'html', 'css', 'json'] as const).map(f => (
              <button
                key={f}
                onClick={() => {
                  if (activeTab !== f) {
                    setActiveTab(f)
                    if (f !== 'visual') setActiveFile(f)
                  }
                }}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  activeTab === f ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* PROACTIVE UX FIX: Allow users to preview how the template looks with different account brandings without needing to hardcode the template JSON */}
          <select 
            className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 max-w-[150px] truncate"
            value={previewAccountId || ''}
            onChange={e => setPreviewAccountId(e.target.value || null)}
            title="Preview Template as Account"
          >
            <option value="">Preview as: No Account</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
          
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
              {renderMainArea()}
            </div>
            <div className="w-1/2">
              <LivePreview html={getPreviewHtml()} className="h-full" />
            </div>
          </>
        ) : (
          <div className="flex-1">
            {renderMainArea()}
          </div>
        )}
      </div>
    </div>
  )
}