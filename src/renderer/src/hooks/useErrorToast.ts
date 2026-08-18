import { useState, useEffect, useCallback } from 'react'
import { onError, type ErrorInfo } from '../lib/error-logger'

interface Toast {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

let toastId = 0

export function useErrorToast(): {
  toasts: Toast[]
  dismiss: (id: number) => void
  showSuccess: (msg: string) => void
  showError: (msg: string) => void
  showInfo: (msg: string) => void
} {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    return onError((error: ErrorInfo) => {
      const id = ++toastId
      setToasts(prev => [...prev, { id, message: error.message, type: 'error' }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 5000)
    })
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showSuccess = useCallback((msg: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message: msg, type: 'success' }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const showInfo = useCallback((msg: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message: msg, type: 'info' }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const showError = useCallback((msg: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message: msg, type: 'error' }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  return { toasts, dismiss, showSuccess, showError, showInfo }
}
