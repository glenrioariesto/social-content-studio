import { describe, it, expect } from 'bun:test'
import {
  ERROR_USER_MESSAGES,
  fail,
  isAppError,
  ok,
  toIPCError,
  userMessageFor,
  createAppError
} from '../../packages/shared/src/errors'

describe('shared error helpers', () => {
  it('ok/fail envelope shapes', () => {
    expect(ok({ a: 1 })).toEqual({ success: true, data: { a: 1 } })
    expect(fail('FS_VALIDATION_ERROR', 'bad')).toEqual({
      success: false,
      error: 'bad',
      errorCode: 'FS_VALIDATION_ERROR'
    })
  })

  it('isAppError narrows shared errors', () => {
    expect(isAppError(createAppError('FS_READ_ERROR', 'x', 'ipc'))).toBe(true)
    expect(isAppError({ code: 'X' })).toBe(false)
    expect(isAppError(null)).toBe(false)
  })

  it('toIPCError preserves AppError code', () => {
    const r = toIPCError(createAppError('ACCOUNT_NOT_FOUND', 'missing', 'ipc'))
    expect(r).toEqual({ success: false, error: 'missing', errorCode: 'ACCOUNT_NOT_FOUND' })
  })

  it('every ErrorCode has an Indonesian user message', () => {
    for (const code of Object.keys(ERROR_USER_MESSAGES)) {
      expect(ERROR_USER_MESSAGES[code as keyof typeof ERROR_USER_MESSAGES].length).toBeGreaterThan(0)
    }
    expect(userMessageFor('FS_PERMISSION_DENIED')).toContain('workspace')
    expect(userMessageFor(undefined, 'fallback')).toBe('fallback')
  })
})
