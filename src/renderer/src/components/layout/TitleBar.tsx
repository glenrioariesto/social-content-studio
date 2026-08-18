import { Minus, Square, X } from 'lucide-react'

export function TitleBar() {
  const w = window.electron?.window

  return (
    <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 drag-region">
      <span className="text-xs font-medium text-zinc-500 select-none">
        Social Content Studio
      </span>
      <div className="flex gap-0.5 no-drag">
        <button
          onClick={() => w?.minimize()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => w?.maximize()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onClick={() => w?.close()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-600 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
