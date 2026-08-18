export function AssetsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="mt-1 text-sm text-zinc-400">Images, audio, video, and fonts</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
          + Upload
        </button>
      </div>
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">No assets yet</p>
      </div>
    </div>
  )
}
