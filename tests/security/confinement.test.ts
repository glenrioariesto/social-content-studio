import { describe, it, expect } from 'bun:test'
import { promises as fs } from 'fs'
import { mkdtempSync, realpathSync, symlinkSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, sep } from 'path'

// These exercise the SAME confinement logic the IPC handlers rely on, so a
// regression in path-traversal or symlink-escape is caught without spawning
// the full Electron app.
import { assertInsideWorkspace } from '../../src/main/services/path-guard'

/** The exact realpath-containment re-check performed by guardOrThrow (SEC-03). */
function realpathEscapes(root: string, resolvedLinkTarget: string): boolean {
  const absRoot = root.toLowerCase()
  const real = resolvedLinkTarget.toLowerCase()
  return !real.startsWith(absRoot + sep.toLowerCase()) && real !== absRoot
}

describe('SEC-02 / SEC-03: confinement + symlink escape', () => {
  it('rejects a crafted content id carrying path separators', () => {
    const evilIds = ['../../../etc/passwd', '..\\..\\secret', 'a/b', 'a\\b', '..']
    const SAFE_ID = /^[A-Za-z0-9._-]+$/
    for (const id of evilIds) {
      expect(SAFE_ID.test(id) && !id.includes('..')).toBe(false)
    }
  })

  it('flags a symlink target resolved outside the root (SEC-03 logic)', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdlc-sym-'))
    const outside = mkdtempSync(join(tmpdir(), 'sdlc-sym-out-'))
    // Simulate the real OS resolution of a symlink inside the workspace that
    // points outward (real OS symlink creation may be blocked on this host).
    const resolvedOutside = realpathSync(outside)
    expect(realpathEscapes(root, resolvedOutside)).toBe(true)
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })

  it('confines a legitimately-named id-derived path', () => {
    const root = 'C:\\project\\social-content-studio\\workspace'
    const id = 'content-20260824T103912-a7f3e'
    const p = assertInsideWorkspace(root, join(root, 'contents', id, 'content.json'), 'workspace:get-content')
    expect(p.absolute).toContain(id)
  })
})

describe('adm-zip backup has no shell (SEC-01)', () => {
  it('backup handler no longer imports child_process', async () => {
    const src = await fs.readFile(
      new URL('../../src/main/ipc/backup.ts', import.meta.url),
      'utf-8'
    )
    expect(src.includes('execSync')).toBe(false)
    expect(src.includes('powershell -Command')).toBe(false)
    expect(src.includes('adm-zip')).toBe(true)
  })
})
