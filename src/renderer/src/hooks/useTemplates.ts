import { useState, useCallback, useEffect } from 'react'
import type { TemplateDefinition } from '@shared/template'
import type { LoadedEntry } from '@shared/loaded-entry'

function validEntries<T>(entries: LoadedEntry<T>[] | undefined): T[] {
  if (!entries) return []
  return entries.filter((e): e is Extract<LoadedEntry<T>, { kind: 'valid' }> => e.kind === 'valid').map(e => e.data)
}

export function useTemplates() {
  const [templates, setTemplates] = useState<TemplateDefinition[]>([])
  const [loading, setLoading] = useState(false)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    const result = await window.electron.workspace.getTemplates()
    if (result.success && result.data) {
      setTemplates(validEntries<TemplateDefinition>(result.data as LoadedEntry<TemplateDefinition>[]))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const createTemplate = useCallback(async (template: TemplateDefinition) => {
    const dir = `workspace/templates/${template.id}`
    await window.electron.fs.mkdir(dir)
    await window.electron.fs.writeFile(
      `${dir}/template.json`,
      JSON.stringify({ ...template, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, null, 2)
    )
    if (template.type === 'html-template' || template.type === 'video-overlay') {
      await window.electron.fs.writeFile(`${dir}/index.html`, DEFAULT_HTML(template))
      await window.electron.fs.writeFile(`${dir}/style.css`, DEFAULT_CSS())
    }
    await loadTemplates()
    return template
  }, [loadTemplates])

  const deleteTemplate = useCallback(async (id: string) => {
    await window.electron.fs.rm(`workspace/templates/${id}`)
    await loadTemplates()
  }, [loadTemplates])

  return { templates, loading, reload: loadTemplates, createTemplate, deleteTemplate }
}

function DEFAULT_HTML(t: TemplateDefinition): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${t.output?.width || 1080}, initial-scale=1.0">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="canvas">
    <div class="overlay">@${t.accountId || 'brand'}</div>
    <div class="main-content">
      <h1 class="title">{{title}}</h1>
      <p class="description">{{description}}</p>
    </div>
    <div class="watermark">{{brand}}</div>
  </div>
</body>
</html>`
}

function DEFAULT_CSS(): string {
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1080px; height: 1920px; overflow: hidden; font-family: 'Inter', system-ui, sans-serif; }
.canvas {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
  display: flex; flex-direction: column;
  justify-content: space-between; padding: 60px 40px;
  color: white; position: relative;
}
.overlay {
  position: absolute; top: 40px; left: 40px;
  background: rgba(99, 102, 241, 0.9); color: white;
  padding: 8px 20px; border-radius: 8px;
  font-size: 24px; font-weight: 700;
}
.main-content {
  flex: 1; display: flex; flex-direction: column;
  justify-content: center; gap: 30px;
}
.title {
  font-size: 72px; font-weight: 800;
  line-height: 1.1; letter-spacing: -0.02em;
}
.description {
  font-size: 32px; color: rgba(255,255,255,0.7);
  line-height: 1.5;
}
.watermark {
  font-size: 20px; color: rgba(255,255,255,0.4);
  text-align: right;
}`
}
