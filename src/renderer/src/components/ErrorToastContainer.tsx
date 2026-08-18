import { useErrorToast } from '@/hooks/useErrorToast'

export function ErrorToastContainer() {
  const { toasts, dismiss } = useErrorToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm
            animate-in slide-in-from-right-full duration-300
            ${toast.type === 'error'
              ? 'border-red-800/50 bg-red-950/80 text-red-200'
              : toast.type === 'success'
                ? 'border-green-800/50 bg-green-950/80 text-green-200'
                : 'border-zinc-700/50 bg-zinc-800/80 text-zinc-200'
            }
          `}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="ml-2 text-current opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
