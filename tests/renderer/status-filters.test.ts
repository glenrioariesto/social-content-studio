import { describe, it, expect } from 'bun:test'
import { buildStatusOptions, statusToLabel, allowedNextStatuses } from '../../src/renderer/src/lib/status-filters'

describe('status-filters (GH-006)', () => {
  it('derives options from shared CONTENT_STATUSES, starting with All', () => {
    const options = buildStatusOptions()
    expect(options[0]).toEqual({ label: 'All statuses', value: 'all' })
    expect(options.slice(1).map(o => o.value)).toEqual(['idea', 'draft', 'ready', 'rendering', 'ready-to-post', 'posted', 'failed'])
    for (const o of options.slice(1)) {
      expect(o.label.length).toBeGreaterThan(0)
    }
  })

  it('exposes allowed transitions from CONTENT_STATUS_FLOW', () => {
    expect(allowedNextStatuses('draft')).toEqual(['ready', 'idea'])
    expect(allowedNextStatuses('rendering')).toEqual(['ready-to-post', 'failed'])
    expect(allowedNextStatuses('ready-to-post')).toEqual(['posted', 'rendering'])
  })

  it('labels are human-readable for every status', () => {
    expect(statusToLabel('ready-to-post')).toBe('Ready to Post')
    expect(statusToLabel('idea')).toBe('Idea')
  })
})