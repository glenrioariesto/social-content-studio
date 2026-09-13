import { describe, it, expect } from 'bun:test'
import {
  SAFE_ID_PATTERN,
  REPLIZ_ID_PATTERN,
  isSafeId,
  isReplizId
} from '../../packages/shared/src/domain'

describe('shared SAFE_ID validation', () => {
  it('accepts server-generated content ids and account slugs', () => {
    expect(isSafeId('content-20260913T020000-a1b2c')).toBe(true)
    expect(isSafeId('glen-rio-aristo')).toBe(true)
    expect(isSafeId('jacksonlab')).toBe(true)
    expect(isSafeId('Some_Account.ID-v2')).toBe(true)
  })

  it('rejects traversal and separator segments', () => {
    expect(isSafeId('..')).toBe(false)
    expect(isSafeId('../etc')).toBe(false)
    expect(isSafeId('a/../b')).toBe(false)
    expect(isSafeId('a\\b')).toBe(false)
    expect(isSafeId('..hidden')).toBe(false)
  })

  it('rejects non-id characters and empty strings', () => {
    expect(isSafeId('a b')).toBe(false)
    expect(isSafeId('a/b')).toBe(false)
    expect(isSafeId('')).toBe(false)
    expect(isSafeId('id!')).toBe(false)
  })

  it('exposes the canonical pattern constant', () => {
    expect(SAFE_ID_PATTERN.source).toBe('^[A-Za-z0-9._-]+$')
  })
})

describe('shared REPLIZ_ID validation (24-hex ObjectId)', () => {
  it('accepts 24-char hex ObjectIds regardless of case', () => {
    expect(isReplizId('0123456789abcdef01234567')).toBe(true)
    expect(isReplizId('ABCDEF0123456789ABCDEF01')).toBe(true)
    expect(isReplizId('abcdef0123456789abcdef12')).toBe(true)
  })

  it('rejects wrong-length and non-hex ids', () => {
    expect(isReplizId('0123456789abcdef0123456')).toBe(false) // 23 chars
    expect(isReplizId('0123456789abcdef012345678')).toBe(false) // 25 chars
    expect(isReplizId('g123456789abcdef0123456')).toBe(false) // 'g' not hex
    expect(isReplizId('0123456789abcdef0123456_')).toBe(false)
    expect(isReplizId('')).toBe(false)
  })

  it('exposes the canonical 24-hex pattern', () => {
    expect(REPLIZ_ID_PATTERN.source).toBe('^[a-f0-9]{24}$')
    expect(REPLIZ_ID_PATTERN.flags).toContain('i')
  })
})