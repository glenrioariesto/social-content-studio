import { describe, it, expect } from 'bun:test'
import { assertInsideWorkspace } from '../../src/main/services/path-guard'
import { createAppError, type ErrorCode } from '../../packages/shared/src/errors'

function isDenied(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'FS_PERMISSION_DENIED'
  )
}

describe('assertInsideWorkspace', () => {
  const root = 'C:\\project\\social-content-studio\\workspace'

  it('allows a relative path joined under root', () => {
    const p = assertInsideWorkspace(root, 'workspace\\templates\\t\\template.json', 'fs:read-file')
    expect(p.absolute).toContain(root)
  })

  it('allows a path already under root', () => {
    const target = `${root}\\contents\\content-1\\content.json`
    const p = assertInsideWorkspace(root, target, 'fs:read-file')
    expect(p.absolute).toBe(target)
  })

  it('refuses an absolute path outside root (other drive)', () => {
    expect(() => assertInsideWorkspace(root, 'C:\\Elsewhere\\note.txt', 'fs:read-file')).toThrow()
    try { assertInsideWorkspace(root, 'C:\\Elsewhere\\note.txt', 'fs:read-file') } catch (e) {
      expect(isDenied(e)).toBe(true)
    }
  })

  it('refuses a .. traversal escaping the root', () => {
    expect(() => assertInsideWorkspace(root, '..\\..\\Windows\\system32\\config.sam', 'fs:read-file')).toThrow()
    try { assertInsideWorkspace(root, '..\\..\\Windows\\system32\\config.sam', 'fs:read-file') } catch (e) {
      expect(isDenied(e)).toBe(true)
    }
  })

  it('treats deleting the root itself as refused', () => {
    expect(() => assertInsideWorkspace(root, root, 'fs:rm')).toThrow()
  })

  it('is case-insensitive on drive and directory names', () => {
    const lower = root.toLowerCase()
    const p = assertInsideWorkspace(root, `${lower}\\contents\\x\\c.json`, 'fs:read-file')
    expect(p.absolute.toLowerCase()).toContain(lower.toLowerCase())
  })
})
