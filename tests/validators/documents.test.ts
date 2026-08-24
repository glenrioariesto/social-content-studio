import { describe, it, expect } from 'bun:test'
import { validateContent, validateTemplate, validateAccount } from '../../packages/shared/src/validators'
import type { Content, Template, Account } from '../../packages/shared/src/index'

describe('validateContent', () => {
  const base: Content = {
    id: 'content-20260824T103912-a7f3e',
    title: 'Test',
    status: 'idea',
    accountId: 'acc-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  it('accepts a well-formed content document', () => {
    const res = validateContent(base)
    expect(res.ok).toBe(true)
  })

  it('rejects a non-object', () => {
    const res = validateContent('not an object')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.issues[0].field).toBe('$')
  })

  it('rejects an unknown status', () => {
    const res = validateContent({ ...base, status: 'bogus' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.issues.some(i => i.field === 'status')).toBe(true)
  })

  it('rejects a missing accountId', () => {
    const { accountId, ...rest } = base
    const res = validateContent(rest)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.issues.some(i => i.field === 'accountId')).toBe(true)
  })

  it('allows optional fields to be absent', () => {
    const res = validateContent(base)
    expect(res.ok).toBe(true)
  })
})

describe('validateTemplate', () => {
  const base: Template = {
    id: 'tpl-1',
    name: 'My Template',
    type: 'html-template',
    input: { type: 'html' },
    output: { width: 1080, height: 1920, fps: 30 }
  }

  it('accepts a well-formed template', () => {
    expect(validateTemplate(base).ok).toBe(true)
  })

  it('rejects a missing name', () => {
    const { name, ...rest } = base
    const res = validateTemplate(rest)
    expect(res.ok).toBe(false)
  })
})

describe('validateAccount', () => {
  const base: Account = {
    id: 'acc-1',
    name: 'Glen',
    workflows: ['manual-video'],
    templates: [],
    branding: { logo: '', watermark: '' }
  }

  it('accepts a well-formed account', () => {
    expect(validateAccount(base).ok).toBe(true)
  })

  it('rejects a missing id', () => {
    const { id, ...rest } = base
    const res = validateAccount(rest)
    expect(res.ok).toBe(false)
  })
})
