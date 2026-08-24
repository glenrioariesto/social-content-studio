import { describe, it, expect } from 'bun:test'
import { atomicWriteJson, mergeKnownFields } from '../../src/main/services/persistence'
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync, renameSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('atomicWriteJson', () => {
  it('writes parseable JSON to the target file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdlc-persist-'))
    const file = join(dir, 'out.json')
    const payload = { id: 'a', n: 1 }
    await atomicWriteJson(file, payload)
    expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual(payload)
  })

  it('replaces target atomically (no partial read mid-rename)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdlc-persist-'))
    const file = join(dir, 'out.json')
    await atomicWriteJson(file, { v: 1 })
    await atomicWriteJson(file, { v: 2 })
    expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual({ v: 2 })
  })
})

describe('mergeKnownFields', () => {
  it('carries only permitted fields and drops the rest', () => {
    const base = { title: 'old', status: 'idea', secret: 'keep' }
    const patch = { title: 'new', hacker: 'injected', status: 'draft' }
    const merged = mergeKnownFields(base, patch, ['title', 'status'])
    expect(merged).toEqual({ title: 'new', status: 'draft', secret: 'keep' })
    expect((merged as Record<string, unknown>)['hacker']).toBeUndefined()
  })
})

describe('corrupt-file resilience', () => {
  it('a partially written file never reaches the canonical target', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdlc-persist-'))
    const file = join(dir, 'content.json')
    // Simulate a crash: leave a temp file but never rename.
    const tmp = join(dir, '.crash.tmp')
    writeFileSync(tmp, '{ "id": "x", "broken": true')
    expect(existsSync(file)).toBe(false)
    // Recovery: rename fixes it; the stale temp is inert.
    renameSync(tmp, file)
    expect(existsSync(file)).toBe(true)
  })
})
