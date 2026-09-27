import { describe, it, expect } from 'bun:test'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
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
  const root = join(tmpdir(), 'test-ws-pathguard')

  it('allows a path joined under root', () => {
    const target = join(root, 'templates', 't', 'template.json')
    const p = assertInsideWorkspace(root, target, 'fs:read-file')
    expect(p.absolute).toBe(resolve(target))
  })

  it('allows a path already under root', () => {
    const target = join(root, 'contents', 'content-1', 'content.json')
    const p = assertInsideWorkspace(root, target, 'fs:read-file')
    expect(p.absolute).toBe(resolve(target))
  })

  it('refuses an absolute path outside root', () => {
    const outside = join(tmpdir(), 'other-dir', 'note.txt')
    expect(() => assertInsideWorkspace(root, outside, 'fs:read-file')).toThrow()
    try { assertInsideWorkspace(root, outside, 'fs:read-file') } catch (e) {
      expect(isDenied(e)).toBe(true)
    }
  })

  it('refuses a .. traversal escaping the root', () => {
    const escapePath = join(root, '..', '..', 'Windows', 'system32', 'config.sam')
    expect(() => assertInsideWorkspace(root, escapePath, 'fs:read-file')).toThrow()
    try { assertInsideWorkspace(root, escapePath, 'fs:read-file') } catch (e) {
      expect(isDenied(e)).toBe(true)
    }
  })

  it('treats deleting the root itself as refused', () => {
    expect(() => assertInsideWorkspace(root, root, 'fs:rm')).toThrow()
  })

  it('is case-insensitive on drive and directory names', () => {
    const lower = root.toLowerCase()
    const target = join(lower, 'contents', 'x', 'c.json')
    const p = assertInsideWorkspace(root, target, 'fs:read-file')
    expect(p.absolute.toLowerCase()).toContain(lower.toLowerCase())
  })
})
