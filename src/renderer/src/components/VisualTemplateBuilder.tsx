import { useState, useEffect } from 'react'
import { Rnd } from 'react-rnd'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Plus, Trash2, ArrowUpToLine, ArrowDownToLine, Copy, Upload } from 'lucide-react'

export interface LayoutElement {
  id: string
  type: 'text' | 'image' | 'account-logo'
  x: number
  y: number
  w: number
  h: number
  content: string 
  color?: string
  fontSize?: number
}

interface CanvasSettings {
  bgColor: string
  bgImage: string
}

interface VisualTemplateBuilderProps {
  jsonContent: string
  onChange: (html: string, css: string, json: string) => void
}

export function VisualTemplateBuilder({ jsonContent, onChange }: VisualTemplateBuilderProps) {
  const [elements, setElements] = useState<LayoutElement[]>([])
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>({ bgColor: '#00000000', bgImage: '' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  // Parse initial elements from JSON
  useEffect(() => {
    try {
      const parsed = JSON.parse(jsonContent)
      if (parsed.layoutElements && Array.isArray(parsed.layoutElements)) {
        setElements(parsed.layoutElements)
      }
      if (parsed.canvasSettings) {
        setCanvasSettings(parsed.canvasSettings)
      }
    } catch {
      // ignore
    }
  }, []) // run once on mount

  // Sync back to parent when elements change
  const compileAndSync = (newElements: LayoutElement[], newCanvas: CanvasSettings = canvasSettings) => {
    setElements(newElements)
    setCanvasSettings(newCanvas)
    
    let html = '<div class="template-canvas">\n'
    let css = `.template-canvas { position: relative; width: 100%; height: 100%; overflow: hidden; background-color: ${newCanvas.bgColor}; ${newCanvas.bgImage ? `background-image: url('${newCanvas.bgImage}'); background-size: cover; background-position: center;` : ''} }\n`
    
    newElements.forEach(el => {
      if (el.type === 'text') {
        html += `  <div id="el-${el.id}" class="visual-el">${el.content}</div>\n`
      } else if (el.type === 'image') {
        html += `  <img id="el-${el.id}" class="visual-el" src="${el.content}" alt="" />\n`
      } else if (el.type === 'account-logo') {
        html += `  <img id="el-${el.id}" class="visual-el" src="{{account.logo}}" alt="Account Logo" />\n`
      }
      
      css += `#el-${el.id} {
  position: absolute;
  left: ${el.x}px;
  top: ${el.y}px;
  width: ${el.w}px;
  height: ${el.h}px;
  color: ${el.color || '#ffffff'};
  font-size: ${el.fontSize || 24}px;
  display: flex;
  align-items: center;
  justify-content: center;
}\n`
    })
    html += '</div>'
    
    try {
      const parsed = JSON.parse(jsonContent || '{}')
      parsed.layoutElements = newElements
      parsed.canvasSettings = newCanvas
      onChange(html, css, JSON.stringify(parsed, null, 2))
    } catch {
      onChange(html, css, jsonContent)
    }
  }

  const addText = () => {
    const offset = elements.length * 15
    const newEl: LayoutElement = {
      id: Date.now().toString(),
      type: 'text',
      x: 50 + offset, y: 50 + offset, w: 200, h: 50,
      content: 'New Text',
      color: '#ffffff',
      fontSize: 24
    }
    compileAndSync([...elements, newEl])
  }

  const addImage = (type: 'image' | 'account-logo' = 'image') => {
    const offset = elements.length * 15
    const newEl: LayoutElement = {
      id: Date.now().toString(),
      type,
      x: 50 + offset, y: 50 + offset, w: 100, h: 100,
      content: type === 'account-logo' ? '{{account.logo}}' : 'https://placehold.co/100x100?text=Image',
    }
    compileAndSync([...elements, newEl])
  }

  const updateSelected = (updates: Partial<LayoutElement>) => {
    compileAndSync(elements.map(el => el.id === selectedId ? { ...el, ...updates } : el))
  }

  const deleteSelected = () => {
    compileAndSync(elements.filter(el => el.id !== selectedId))
    setSelectedId(null)
  }

  const duplicateSelected = () => {
    if (!selectedId) return
    const el = elements.find(e => e.id === selectedId)
    if (!el) return
    
    const newEl: LayoutElement = {
      ...el,
      id: Date.now().toString(),
      x: el.x + 20,
      y: el.y + 20
    }
    compileAndSync([...elements, newEl])
    setSelectedId(newEl.id)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      updateSelected({ content: base64 })
    }
    reader.readAsDataURL(file)
  }

  const bringToFront = () => {
    if (!selectedId) return
    const el = elements.find(e => e.id === selectedId)
    if (!el) return
    const others = elements.filter(e => e.id !== selectedId)
    compileAndSync([...others, el])
  }

  const sendToBack = () => {
    if (!selectedId) return
    const el = elements.find(e => e.id === selectedId)
    if (!el) return
    const others = elements.filter(e => e.id !== selectedId)
    compileAndSync([el, ...others])
  }

  return (
    <div className="flex h-full border-t border-zinc-800">
      {/* Canvas */}
      <div 
        className="flex-1 relative overflow-hidden" 
        style={{ backgroundColor: canvasSettings.bgColor, backgroundImage: canvasSettings.bgImage ? `url(${canvasSettings.bgImage})` : 'none', backgroundSize: 'cover' }}
        onClick={() => setSelectedId(null)}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          1080 x 1920
        </div>
        
        {elements.map(el => (
          <Rnd
            key={el.id}
            size={{ width: el.w, height: el.h }}
            position={{ x: el.x, y: el.y }}
            onDragStop={(e, d) => {
              compileAndSync(elements.map(e => e.id === el.id ? { ...e, x: d.x, y: d.y } : e))
            }}
            onResizeStop={(e, dir, ref, delta, position) => {
              compileAndSync(elements.map(e => e.id === el.id ? { 
                ...e, 
                w: parseInt(ref.style.width, 10), 
                h: parseInt(ref.style.height, 10),
                ...position 
              } : e))
            }}
            bounds="parent"
            dragGrid={[5, 5]} // Snapping precision
            resizeGrid={[5, 5]}
            className={`border ${selectedId === el.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-dashed border-zinc-700/50 hover:border-zinc-400'}`}
            onClick={(e: any) => { e.stopPropagation(); setSelectedId(el.id) }}
          >
            <div 
              style={{ color: el.color, fontSize: el.fontSize }}
              className="w-full h-full flex items-center justify-center break-words p-2"
            >
              {el.type === 'text' ? el.content : (
                <img 
                  src={el.type === 'account-logo' ? 'https://placehold.co/100x100/1e1e2e/6366f1?text=Logo' : el.content} 
                  className="w-full h-full object-contain pointer-events-none" 
                  alt="" 
                />
              )}
            </div>
          </Rnd>
        ))}
      </div>

      {/* Sidebar Controls */}
      <div className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col">
        <div className="p-3 border-b border-zinc-800 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={addText}><Plus className="h-3 w-3 mr-1"/> Text</Button>
          <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={() => addImage('image')}><Plus className="h-3 w-3 mr-1"/> Image</Button>
          <Button size="sm" variant="outline" className="w-full text-xs border-indigo-500/30 text-indigo-300" onClick={() => addImage('account-logo')}><Plus className="h-3 w-3 mr-1"/> Account Logo</Button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {selectedId ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Selected Element</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-zinc-200" onClick={duplicateSelected} title="Duplicate">
                    <Copy className="h-3 w-3"/>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={deleteSelected} title="Delete">
                    <Trash2 className="h-3 w-3"/>
                  </Button>
                </div>
              </div>
              
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300 block mb-2">Layer Order</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={bringToFront}>
                    <ArrowUpToLine className="h-3 w-3 mr-1"/> Front
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={sendToBack}>
                    <ArrowDownToLine className="h-3 w-3 mr-1"/> Back
                  </Button>
                </div>
              </div>
              {elements.find(e => e.id === selectedId)?.type === 'text' && (
                <>
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block">Text Content</label>
                    <Input 
                      className="text-xs py-1"
                      value={elements.find(e => e.id === selectedId)?.content || ''} 
                      onChange={e => updateSelected({ content: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 mb-1 block">Color (Hex)</label>
                      <Input 
                        className="text-xs py-1"
                        value={elements.find(e => e.id === selectedId)?.color || ''} 
                        onChange={e => updateSelected({ color: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 mb-1 block">Size (px)</label>
                      <Input 
                        className="text-xs py-1"
                        type="number"
                        value={elements.find(e => e.id === selectedId)?.fontSize || ''} 
                        onChange={e => updateSelected({ fontSize: parseInt(e.target.value, 10) || 12 })}
                      />
                    </div>
                  </div>
                </>
              )}
              {elements.find(e => e.id === selectedId)?.type === 'image' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block">Image URL or Base64</label>
                    <Input 
                      className="text-xs py-1"
                      value={elements.find(e => e.id === selectedId)?.content || ''} 
                      onChange={e => updateSelected({ content: e.target.value })}
                    />
                  </div>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleImageUpload}
                    />
                    <Button variant="outline" className="w-full text-xs text-zinc-300 border-zinc-700 pointer-events-none">
                      <Upload className="h-3 w-3 mr-2" /> Upload Local Image
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300 block mb-2">Precision Layout</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 block">X Position</label>
                    <Input type="number" className="text-xs py-1" value={elements.find(e => e.id === selectedId)?.x || 0} onChange={e => updateSelected({ x: parseInt(e.target.value, 10) || 0 })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block">Y Position</label>
                    <Input type="number" className="text-xs py-1" value={elements.find(e => e.id === selectedId)?.y || 0} onChange={e => updateSelected({ y: parseInt(e.target.value, 10) || 0 })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block">Width</label>
                    <Input type="number" className="text-xs py-1" value={elements.find(e => e.id === selectedId)?.w || 0} onChange={e => updateSelected({ w: Math.max(10, parseInt(e.target.value, 10) || 10) })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block">Height</label>
                    <Input type="number" className="text-xs py-1" value={elements.find(e => e.id === selectedId)?.h || 0} onChange={e => updateSelected({ h: Math.max(10, parseInt(e.target.value, 10) || 10) })} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center text-xs text-zinc-500 mb-6">
                Select an element to edit properties, or click Canvas to edit background.
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-xs font-semibold text-zinc-300 block mb-3">Canvas Settings</span>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block">Background Color (Hex/RGBA)</label>
                    <Input 
                      className="text-xs py-1"
                      value={canvasSettings.bgColor} 
                      onChange={e => compileAndSync(elements, { ...canvasSettings, bgColor: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block">Background Image URL</label>
                    <Input 
                      className="text-xs py-1"
                      value={canvasSettings.bgImage} 
                      onChange={e => compileAndSync(elements, { ...canvasSettings, bgImage: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
