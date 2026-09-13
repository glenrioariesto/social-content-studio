import { describe, it, expect } from 'bun:test'
import { validEntries } from '../../src/renderer/src/lib/entries'

describe('validEntries', () => {
  const valid = { kind: 'valid', id: 'c1', data: { title: 'OK' } }
  const invalid = {
    kind: 'invalid',
    id: 'c2',
    file: 'c2.json',
    issues: [{ field: 'title', message: 'missing' }]
  }

  it('extracts only valid entries', () => {
    expect(validEntries([valid, invalid] as never)).toEqual([{ title: 'OK' }])
  })

  it('returns an empty list for undefined or all-invalid input', () => {
    expect(validEntries(undefined)).toEqual([])
    expect(validEntries([invalid] as never)).toEqual([])
  })

  it('preserves entry order', () => {
    expect(validEntries([invalid, valid] as never)).toEqual([{ title: 'OK' }])
  })
})