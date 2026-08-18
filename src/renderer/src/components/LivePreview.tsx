import { useRef, useEffect, useCallback } from 'react'

interface LivePreviewProps {
  html: string
  width?: number
  height?: number
  className?: string
}

export function LivePreview({ html, width = 1080, height = 1920, className = '' }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const updatePreview = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [html])

  useEffect(() => {
    const timer = setTimeout(updatePreview, 150)
    return () => clearTimeout(timer)
  }, [updatePreview])

  const scale = Math.min(1, 400 / width)

  return (
    <div className={`overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 ${className}`}>
      <div className="flex items-center justify-center p-4" style={{ minHeight: 400 }}>
        <div
          style={{
            width: width * scale,
            height: height * scale,
            overflow: 'hidden',
            borderRadius: 8
          }}
        >
          <iframe
            ref={iframeRef}
            title="Preview"
            style={{
              width: width,
              height: height,
              border: 'none',
              transform: `scale(${scale})`,
              transformOrigin: 'top left'
            }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
      <div className="border-t border-zinc-800 px-3 py-2 text-center text-[10px] text-zinc-600">
        {width} × {height} · Portrait 9:16 · Live Preview
      </div>
    </div>
  )
}
