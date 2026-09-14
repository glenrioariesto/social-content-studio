import { describe, it, expect } from 'bun:test'
import { sanitizeFileName, parseResourceMeta, isAllowedDownloadUrl } from '../../src/main/services/resource-utils'

describe('sanitizeFileName', () => {
  const fallback = 'fallback.mp4'

  it('returns the fallback for empty input', () => {
    expect(sanitizeFileName('', fallback)).toBe(fallback)
  })

  it('returns the fallback for dot paths', () => {
    expect(sanitizeFileName('.', fallback)).toBe(fallback)
    expect(sanitizeFileName('..', fallback)).toBe(fallback)
  })

  it('strips a posix directory prefix', () => {
    expect(sanitizeFileName('media/video1.mp4', fallback)).toBe('video1.mp4')
  })

  it('never returns a path containing a backslash', () => {
    const result = sanitizeFileName('a\\b.mp4', fallback)
    expect(result).not.toContain('\\')
    expect(['b.mp4', fallback]).toContain(result)
  })

  it('keeps plain names with extensions', () => {
    expect(sanitizeFileName('video1.mp4', fallback)).toBe('video1.mp4')
  })
})

describe('parseResourceMeta', () => {
  it('parses a valid resource meta', () => {
    const raw = JSON.stringify({
      id: 'video1.mp4',
      source: 'internet',
      fileName: 'video1.mp4',
      filePath: 'workspace\\resources\\video1.mp4',
      status: 'ready',
      createdAt: '2026-09-13T00:00:00.000Z'
    })
    const meta = parseResourceMeta(raw)
    expect(meta).not.toBeNull()
    expect(meta?.id).toBe('video1.mp4')
    expect(meta?.status).toBe('ready')
  })

  it('returns null for invalid JSON', () => {
    expect(parseResourceMeta('{ not json')).toBeNull()
  })

  it('returns null for a JSON array or primitive', () => {
    expect(parseResourceMeta('[]')).toBeNull()
    expect(parseResourceMeta('"hello"')).toBeNull()
    expect(parseResourceMeta('42')).toBeNull()
  })

  it('returns null when the id field is missing or empty', () => {
    expect(parseResourceMeta('{"fileName":"x.mp4"}')).toBeNull()
    expect(parseResourceMeta('{"id":""}')).toBeNull()
  })
})

describe('isAllowedDownloadUrl', () => {
  it('allows https URLs', () => {
    expect(isAllowedDownloadUrl('https://example.com/video.mp4')).toBe(true)
  })

  it('allows http URLs and trims surrounding whitespace', () => {
    expect(isAllowedDownloadUrl('  http://example.com/x.mp4  ')).toBe(true)
  })

  it('rejects non-http schemes', () => {
    expect(isAllowedDownloadUrl('ftp://example.com/v.mp4')).toBe(false)
    expect(isAllowedDownloadUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects option-injection inputs that begin with a dash', () => {
    expect(isAllowedDownloadUrl('-o /tmp/out')).toBe(false)
    expect(isAllowedDownloadUrl('--skip-download https://example.com')).toBe(false)
  })

  it('rejects empty or blank input', () => {
    expect(isAllowedDownloadUrl('')).toBe(false)
    expect(isAllowedDownloadUrl('   ')).toBe(false)
  })
})