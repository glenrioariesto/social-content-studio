import { useState, useEffect, useCallback } from 'react'

interface FileContent {
  html: string
  css: string
  json: string
}

export function useTemplateEditor(templateId: string | null) {
  const [files, setFiles] = useState<FileContent>({ html: '', css: '', json: '' })
  const [activeFile, setActiveFile] = useState<'html' | 'css' | 'json'>('html')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(true)

  const loadFiles = useCallback(async () => {
    if (!templateId) return
    setLoading(true)
    const base = `workspace/templates/${templateId}`
    const [htmlRes, cssRes, jsonRes] = await Promise.all([
      window.electron.fs.readFile(`${base}/index.html`),
      window.electron.fs.readFile(`${base}/style.css`),
      window.electron.fs.readFile(`${base}/template.json`)
    ])
    setFiles({
      html: htmlRes.success ? htmlRes.data || '' : '',
      css: cssRes.success ? cssRes.data || '' : '',
      json: jsonRes.success ? jsonRes.data || '{}' : '{}'
    })
    setLoading(false)
    setSaved(true)
  }, [templateId])

  useEffect(() => { loadFiles() }, [loadFiles])

  const updateFile = useCallback((file: 'html' | 'css' | 'json', content: string) => {
    setFiles(prev => ({ ...prev, [file]: content }))
    setSaved(false)
  }, [])

  const save = useCallback(async () => {
    if (!templateId) return
    const base = `workspace/templates/${templateId}`
    await Promise.all([
      window.electron.fs.writeFile(`${base}/index.html`, files.html),
      window.electron.fs.writeFile(`${base}/style.css`, files.css),
      window.electron.fs.writeFile(`${base}/template.json`, files.json)
    ])
    setSaved(true)
  }, [templateId, files])

  const getPreviewHtml = useCallback(() => {
    const cssInjection = `<style>${files.css}</style>`
    let html = files.html
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${cssInjection}</head>`)
    } else {
      html = `${cssInjection}${html}`
    }
    return html
  }, [files])

  return { files, activeFile, setActiveFile, updateFile, save, saved, loading, getPreviewHtml, reload: loadFiles }
}
