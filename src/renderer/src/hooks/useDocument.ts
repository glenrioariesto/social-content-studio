import { useCallback, useEffect, useRef, useState } from 'react'

export interface DocumentState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Loads a document (or list) from an async loader and exposes loading/error/ready
 * state. Keeps previously loaded data across reloads to avoid layout flashes.
 * The loader identity is captured in a ref so callers may redefine it each render;
 * pass stable `deps` to trigger automatic reloads (e.g. active filters).
 */
export function useDocument<T>(loader: () => Promise<T>, deps: unknown[] = []): DocumentState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const reload = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loaderRef.current()
      .then(value => {
        if (!cancelled) setData(value)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
  }, [])

  useEffect(() => {
    reload()
  }, [reload, ...deps])

  return { data, loading, error, reload }
}