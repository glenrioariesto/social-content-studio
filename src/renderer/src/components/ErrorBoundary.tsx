import { Component, type ReactNode, type ErrorInfo } from 'react'
import { logRendererError, type ErrorInfo as AppErrorInfo } from '@/lib/error-logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const info: AppErrorInfo = {
      code: 'RENDERER_CRASH',
      message: error.message,
      source: 'renderer-boundary',
      details: {
        componentStack: errorInfo.componentStack
      },
      timestamp: Date.now()
    }
    logRendererError(info)
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-100">
          <div className="max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
            <p className="mb-4 text-sm text-zinc-400">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
