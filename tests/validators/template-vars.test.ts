import { describe, it, expect } from 'bun:test'
import { applyTemplateVariables, logoToFileUrl } from '../../packages/shared/src/template-vars'
import type { Account } from '../../packages/shared/src/index'

const account: Account = {
  id: 'acc-1',
  name: 'JacksonLab',
  description: 'AI research brand',
  workflows: [],
  templates: [],
  branding: { logo: 'assets/logo.png' }
}

describe('logoToFileUrl', () => {
  it('converts a relative asset path to a file:// URL', () => {
    expect(logoToFileUrl('assets/logo.png')).toBe('file://assets/logo.png')
  })
  it('returns empty string for absent logo', () => {
    expect(logoToFileUrl(undefined)).toBe('')
    expect(logoToFileUrl('')).toBe('')
  })
})

describe('applyTemplateVariables', () => {
  it('substitutes all three account variables', () => {
    const html = '<h1>{{account.name}}</h1><p>{{account.description}}</p><img src="{{account.logo}}">'
    const out = applyTemplateVariables(html, { account })
    expect(out).toContain('JacksonLab')
    expect(out).toContain('AI research brand')
    expect(out).toContain('src="file://assets/logo.png"')
  })

  it('substitutes to empty string when fields are absent', () => {
    const bare: Account = { ...account, description: undefined, branding: {} }
    const out = applyTemplateVariables('<p>{{account.description}}|{{account.logo}}</p>', { account: bare })
    expect(out).toBe('<p>|</p>')
  })

  it('leaves unknown placeholders untouched', () => {
    const out = applyTemplateVariables('{{foo.bar}} {{custom.x}}', { account })
    expect(out).toBe('{{foo.bar}} {{custom.x}}')
  })

  it('handles missing context without crashing', () => {
    const out = applyTemplateVariables('<h1>{{account.name}}</h1>', {})
    expect(out).toBe('<h1></h1>')
  })

  it('tolerates whitespace inside braces', () => {
    const out = applyTemplateVariables('{{ account.name }}', { account })
    expect(out).toBe('JacksonLab')
  })
})
