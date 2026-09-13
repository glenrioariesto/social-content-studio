import { validateAgentInvoke } from '../packages/shared/src/agent'

const cases: { label: string; req: unknown }[] = [
  { label: 'legal transition', req: { tool: 'content.transition', args: { id: 'content-abc', to: 'draft' } } },
  { label: 'traversal id', req: { tool: 'content.get', args: { id: '../../x' } } },
  { label: 'bad status', req: { tool: 'content.transition', args: { id: 'content-abc', to: 'scheduled' } } },
  { label: 'bad preset', req: { tool: 'render.enqueue', args: { contentId: 'content-abc', preset: 'youtube-landscape' } } },
  { label: 'unknown tool', req: { tool: 'fs.rm', args: {} } }
]

let failed = 0
for (const c of cases) {
  const result = validateAgentInvoke(c.req)
  const expectedOk = c.label === 'legal transition'
  const pass = result.ok === expectedOk
  console.log(`${pass ? 'PASS' : 'FAIL'} ${c.label}: ${JSON.stringify(result)}`)
  if (!pass) failed++
}

if (failed > 0) process.exit(1)
console.log('Agent guard check passed.')
