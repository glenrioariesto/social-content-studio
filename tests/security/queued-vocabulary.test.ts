import { describe, it, expect } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'out' || name === 'public') continue
      collectFiles(full, out)
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

/**
 * REQ-002: render status vocabulary is `waiting`; `queued` only allowed
 * in the legacy remap and the batch IPC data-field name.
 */
const ALLOWED_FILES = new Set([
  'src/main/services/render-queue.ts',    // legacy remap: status 'queued' → 'waiting'
  'packages/shared/src/resource.ts'       // ResourceSyncStatus: 'queued' | 'downloading' — different concept (resource sync, not render)
])

describe('render status vocabulary', () => {
  it('purges `queued` vocabulary from main/preload/renderer/shared source', () => {
    const roots = ['src/main', 'src/preload', 'src/renderer/src', 'packages/shared/src']
    const offenders: string[] = []
    for (const root of roots) {
      for (const file of collectFiles(root)) {
        const normalised = file.replace(/\\/g, '/')
        if (ALLOWED_FILES.has(normalised)) continue
        if (/queued/i.test(readFileSync(file, 'utf-8'))) {
          offenders.push(normalised)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps only the legacy status remap in render-queue.ts', () => {
    const text = readFileSync('src/main/services/render-queue.ts', 'utf-8')
    const lines = text.split('\n').filter(l => /queued/i.test(l))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain("'queued'")
  })
})
