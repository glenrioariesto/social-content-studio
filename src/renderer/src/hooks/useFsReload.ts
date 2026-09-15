import { useEffect, useRef } from 'react'
import type { FileChangeEvent } from '@shared/index'

const rel = (event: FileChangeEvent) => event.relativePath || event.path

/**
 * Auto-reloads a document when the main-process file watcher reports a change
 * under a given workspace scope (e.g. "contents", "templates"). Events are
 * debounced upstream; this hook only filters and forwards.
 */
export function useFsReload(scope: string, reload: () => void): void {
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const scopeRef = useRef(scope)
  scopeRef.current = scope

  useEffect(() => {
    return window.electron.on('fs:changed', (payload: unknown) => {
      const event = payload as FileChangeEvent
      if (!event || typeof event.relativePath !== 'string' && typeof event.path !== 'string') return
      if (rel(event).split('/').includes(scope)) {
        reloadRef.current()
      }
    })
  }, [])
}

/** Extracts the workspace scope (first path segment) from a relative path. */
export function scopeOf(event: FileChangeEvent): string {
  return rel(event).split('/').filter(Boolean)[0] ?? ''
}