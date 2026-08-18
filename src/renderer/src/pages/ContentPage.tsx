export function ContentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage all your content</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
          + New Content
        </button>
      </div>

      <div className="flex gap-2">
        {['All', 'Draft', 'Ready', 'Rendering', 'Ready to Post', 'Posted'].map(filter => (
          <button
            key={filter}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">No content yet</p>
      </div>
    </div>
  )
}
