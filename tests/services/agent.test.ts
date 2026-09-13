import { describe, it, expect } from 'bun:test'
import { AGENT_TOOLS, validateAgentInvoke, getAgentTool } from '../../packages/shared/src/agent'

describe('agent tools', () => {
  it('exposes 8 intent-only tools', () => {
    expect(AGENT_TOOLS.length).toBe(8)
    expect(getAgentTool('content.transition')?.channel).toBe('workspace:update-content')
  })

  it('rejects unknown tool', () => {
    const r = validateAgentInvoke({ tool: 'fs.rm', args: {} })
    expect(r.ok).toBe(false)
  })

  it('rejects traversal id', () => {
    const r = validateAgentInvoke({ tool: 'content.get', args: { id: '../../x' } })
    expect(r.ok).toBe(false)
  })

  it('rejects bad status and preset', () => {
    const s = validateAgentInvoke({ tool: 'content.transition', args: { id: 'content-1', to: 'scheduled' } })
    expect(s.ok).toBe(false)
    const p = validateAgentInvoke({ tool: 'render.enqueue', args: { contentId: 'content-1', preset: 'youtube-landscape' } })
    expect(p.ok).toBe(false)
  })

  it('accepts a legal invoke', () => {
    const r = validateAgentInvoke({ tool: 'render.enqueue', args: { contentId: 'content-abc', preset: 'tiktok' } })
    expect(r.ok).toBe(true)
  })
})
