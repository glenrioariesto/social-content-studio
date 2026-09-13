import { describe, it, expect } from 'bun:test'
import { assertSafeId, assertReplizId } from '../../src/main/ipc/ipc-handler'
import { SAFE_ID_PATTERN, REPLIZ_ID_PATTERN } from '../../packages/shared/src/domain'

describe('central ipc guards', () => {
  it('SAFE_ID accepts local ids and rejects traversal', () => {
    expect(SAFE_ID_PATTERN.test('content-abc_1.2-3')).toBe(true)
    expect(() => assertSafeId('../../x', 'test')).toThrow()
  })

  it('REPLIZ_ID accepts 24-hex and rejects unsafe tokens', () => {
    expect(REPLIZ_ID_PATTERN.test('680affa5ce12f2f72916f67e')).toBe(true)
    for (const bad of ['../x', 'a/b', 'has space', 'x'.repeat(65)]) {
      expect(() => assertReplizId(bad)).toThrow()
    }
  })
})
