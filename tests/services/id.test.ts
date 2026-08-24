import { describe, it, expect } from 'bun:test'
import { generateContentId, generateUniqueContentId } from '../../src/main/services/id'
import { mkdtempSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('generateContentId', () => {
  it('produces the content-<ts>-<5hex> shape', () => {
    const id = generateContentId(new Date('2026-08-24T10:39:12'))
    expect(id).toMatch(/^content-\d{8}T\d{6}-[0-9a-f]{5}$/)
  })

  it('encodes the local timestamp', () => {
    const id = generateContentId(new Date(2026, 7, 24, 10, 39, 12))
    expect(id.startsWith('content-20260824T103912-')).toBe(true)
  })

  it('produces distinct ids across rapid calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateContentId()))
    expect(ids.size).toBe(20)
  })
})

describe('generateUniqueContentId', () => {
  it('never collides with an existing directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdlc-id-'))
    const existing = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const id = generateUniqueContentId(dir)
      expect(existing.has(id)).toBe(false)
      expect(existsSync(join(dir, id))).toBe(false)
      mkdirSync(join(dir, id))
      existing.add(id)
    }
    expect(existing.size).toBe(10)
  })

  it('retries when the first attempt already exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdlc-id-'))
    const first = generateContentId()
    mkdirSync(join(dir, first))
    const got = generateUniqueContentId(dir)
    expect(got).not.toBe(first)
    expect(existsSync(join(dir, got))).toBe(false)
  })
})
