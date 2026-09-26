import { useState, useEffect, useCallback } from 'react'
import { applyTemplateVariables } from '@shared/template-vars'
import { useAccounts } from './useAccounts'

interface FileContent {
  html: string
  css: string
  json: string
}

export function useTemplateEditor(templateId: string | null) {
  const [files, setFiles] = useState<FileContent>({ html: '', css: '', json: '' })
  const { accounts } = useAccounts()
  const [activeFile, setActiveFile] = useState<'html' | 'css' | 'json'>('html')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(true)
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | undefined>(undefined)
  const [previewAccountId, setPreviewAccountId] = useState<string | null>(null)
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

  // Resolve absolute logo URL for preview
  useEffect(() => {
    const tplAccountId = previewAccountId || (() => {
      try { return JSON.parse(files.json || '{}')?.accountId }
      catch { return undefined }
    })()
    const acc = tplAccountId ? accounts.find(a => a.id === tplAccountId) : undefined
    if (acc) {
      window.electron.account.getLogoUrl(acc.id).then(res => {
        if (res.success && res.data) setPreviewLogoUrl(res.data)
        else setPreviewLogoUrl(undefined)
      })
    } else {
      setPreviewLogoUrl(undefined)
    }
  }, [files.json, accounts])

  const getPreviewHtml = useCallback(() => {
    const cssInjection = `<style>${files.css}</style>`
    let html = files.html
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${cssInjection}</head>`)
    } else {
      html = `${cssInjection}${html}`
    }
    // FR-4: substitute account branding variables in the live preview.
    let boundAccount
    try {
      const tplAccountId = previewAccountId || JSON.parse(files.json || '{}')?.accountId
      boundAccount = tplAccountId ? accounts.find(a => a.id === tplAccountId) : undefined
    } catch {
      boundAccount = undefined
    }
    
    // Inject the resolved absolute logo URL if available
    const ctxAccount = boundAccount ? { 
      ...boundAccount, 
      branding: { ...boundAccount.branding, logo: previewLogoUrl || boundAccount.branding?.logo } 
    } : undefined
    
    return applyTemplateVariables(html, ctxAccount ? { account: ctxAccount } : {})
  }, [files, accounts, previewLogoUrl])

  return { files, activeFile, setActiveFile, updateFile, save, saved, loading, getPreviewHtml, reload: loadFiles, previewAccountId, setPreviewAccountId, accounts }
}
