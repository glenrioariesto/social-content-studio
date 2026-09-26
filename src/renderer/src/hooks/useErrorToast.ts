import { useEffect } from 'react'
import { onError, type ErrorInfo } from '@/lib/error-logger'
import { create } from 'zustand'

interface Toast {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

interface ToastState {
  toasts: Toast[]
  dismiss: (id: number) => void
  showSuccess: (msg: string) => void
  showError: (msg: string) => void
  showInfo: (msg: string) => void
}

let toastId = 0

export const useErrorToast = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
  showSuccess: (msg) => {
    const id = ++toastId
    set((state) => ({ toasts: [...state.toasts, { id, message: msg, type: 'success' }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 3000)
  },
  showInfo: (msg) => {
    const id = ++toastId
    set((state) => ({ toasts: [...state.toasts, { id, message: msg, type: 'info' }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 3000)
  },
  showError: (msg) => {
    const id = ++toastId
    set((state) => ({ toasts: [...state.toasts, { id, message: msg, type: 'error' }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 5000)
  }
}))

// Keep global listener for errors to plug into store
onError((error: ErrorInfo) => {
  useErrorToast.getState().showError(error.message)
})
