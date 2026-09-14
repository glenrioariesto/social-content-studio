import { describe, it, expect } from 'bun:test'
import { sanitizeForLog } from '../../src/main/services/log-redact'

describe('sanitizeForLog', () => {
  it('redacts whole args for sensitive channels (repliz credentials)', () => {
    const out = sanitizeForLog('repliz:save-credentials', ['AKIA123', 'sk-secret-xyz'])
    expect(out).toEqual({ redacted: true, argCount: 2 })
    expect(JSON.stringify(out)).not.toContain('AKIA123')
    expect(JSON.stringify(out)).not.toContain('sk-secret-xyz')
  })

  it('passes through at most 3 args for normal channels', () => {
    expect(sanitizeForLog('fs:read-file', ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c'])
    expect(sanitizeForLog('fs:read-file', ['only'])).toEqual(['only'])
  })

  it('never leaks sensitive-channel metadata as plaintext args', () => {
    expect(sanitizeForLog('repliz:save-credentials', [])).toEqual({ redacted: true, argCount: 0 })
  })
})