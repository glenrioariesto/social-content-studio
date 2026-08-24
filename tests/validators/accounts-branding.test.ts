import { describe, it, expect } from 'bun:test'
import { validateAccount } from '../../packages/shared/src/validators'

const base = {
  id: 'glen-rio-aristo',
  name: 'Glen Rio Aristo',
  workflows: ['manual-video'],
  templates: []
}

describe('validateAccount — Flexible Branding additions', () => {
  it('accepts an account with no description and no branding (legacy shape)', () => {
    const r = validateAccount(base)
    expect(r.ok).toBe(true)
  })

  it('accepts legacy empty-string logo as absent (Audit FINDING-B)', () => {
    const r = validateAccount({ ...base, branding: { logo: '', watermark: '' } })
    expect(r.ok).toBe(true)
  })

  it('accepts valid description and assets-relative png logo', () => {
    const r = validateAccount({
      ...base,
      description: 'Luxury brand',
      branding: { logo: 'assets/logo.png' }
    })
    expect(r.ok).toBe(true)
  })

  it('accepts all whitelisted extensions', () => {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'svg']) {
      const r = validateAccount({ ...base, branding: { logo: `assets/logo.${ext}` } })
      expect(r.ok).toBe(true)
    }
  })

  it('rejects a non-string description', () => {
    const r = validateAccount({ ...base, description: 42 })
    expect(r.ok).toBe(false)
  })

  it('rejects a logo escaping the assets dir or with a bad extension', () => {
    for (const bad of [
      '../../etc/passwd',
      'images/logo.png',
      'assets/logo.exe',
      'assets/../secret.png',
      'assets/sub/dir/logo.png'
    ]) {
      const r = validateAccount({ ...base, branding: { logo: bad } })
      expect(r.ok).toBe(false)
    }
  })
})
