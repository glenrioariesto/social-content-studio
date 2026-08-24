import { describe, it, expect } from 'bun:test'
import { assertLegalTransition } from '../../src/main/services/lifecycle'
import { CONTENT_STATUS_FLOW } from '../../packages/shared/src/index'
import { createAppError, type ErrorCode } from '../../packages/shared/src/errors'

function isIllegal(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'CONTENT_INVALID_STATUS'
  )
}

describe('assertLegalTransition', () => {
  it('allows every transition declared in CONTENT_STATUS_FLOW', () => {
    for (const from of Object.keys(CONTENT_STATUS_FLOW) as Array<keyof typeof CONTENT_STATUS_FLOW>) {
      for (const to of CONTENT_STATUS_FLOW[from]) {
        expect(() => assertLegalTransition(from, to)).not.toThrow()
      }
    }
  })

  it('refuses an illegal transition', () => {
    expect(() => assertLegalTransition('idea', 'posted')).toThrow()
    try { assertLegalTransition('idea', 'posted') } catch (e) {
      expect(isIllegal(e)).toBe(true)
    }
  })

  it('refuses rendering -> idea (not in the flow)', () => {
    expect(() => assertLegalTransition('rendering', 'idea')).toThrow()
  })
})
