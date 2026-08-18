export function AccountsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage social media accounts</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
          + New Account
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'Glen Rio Aristo', workflows: ['Manual Video'], color: 'bg-purple-600' },
          { name: 'JacksonLab', workflows: ['Internet Video', 'Manual Video'], color: 'bg-blue-600' },
          { name: 'HighProduct', workflows: ['Product Video', 'Manual Video'], color: 'bg-emerald-600' }
        ].map(account => (
          <div key={account.name} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${account.color} text-xs font-bold text-white`}>
                {account.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-semibold">{account.name}</h3>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {account.workflows.map(w => (
                <span key={w} className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                  {w}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
