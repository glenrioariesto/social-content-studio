export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Application configuration</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Render Settings</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-zinc-400">Default Preset</label>
              <select className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500">
                <option>Instagram Reels</option>
                <option>TikTok</option>
                <option>YouTube Shorts</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-zinc-400">Max Concurrent Renders</label>
              <select className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500">
                <option>1</option>
                <option>2</option>
                <option>3</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Workspace</h2>
          <p className="text-sm text-zinc-500">workspace/</p>
        </div>
      </div>
    </div>
  )
}
