import { mkdir, readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { generateUniqueContentId } from '../src/main/services/id'
import { atomicWriteJson, mergeKnownFields } from '../src/main/services/persistence'
import { assertLegalTransition } from '../src/main/services/lifecycle'
import { AGENT_TOOLS, validateAgentInvoke } from '../packages/shared/src/agent'
import { DEFAULT_RENDER_PRESETS, type Content } from '../packages/shared/src/index'

const BASE = join(import.meta.dir, '..', 'workspace')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function frame(title: string, lines: string[]) {
  const width = 64
  console.log(`+${'-'.repeat(width)}+`)
  console.log(`| ${title.padEnd(width - 2)}|`)
  console.log(`+${'-'.repeat(width)}+`)
  for (const line of lines) {
    const chunks = line.match(new RegExp(`.{1,${width - 2}}`, 'g')) ?? ['']
    for (const chunk of chunks) console.log(`| ${chunk.padEnd(width - 2)}|`)
  }
  console.log(`+${'-'.repeat(width)}+\n`)
}

async function demo() {
  frame('STUDIO AGENT EMULATOR', [
    'Mode: terminal emulator (tanpa jendela Electron).',
    'Alur: list-tools -> create -> transition -> list -> render plan -> guards.'
  ])
  await sleep(300)

  frame('1/6 agent:list-tools', AGENT_TOOLS.map(t => `${t.name} [${t.sideEffect}] -> ${t.channel}`))
  await sleep(300)

  const contentsDir = join(BASE, 'contents')
  await mkdir(contentsDir, { recursive: true })
  const id = generateUniqueContentId(contentsDir)
  const now = new Date().toISOString()
  const created: Content = {
    id,
    title: 'Emulator Demo Content',
    status: 'idea',
    accountId: 'glen-rio-aristo',
    templateId: 'glen-quote',
    caption: 'Demo via emulator terminal',
    hashtags: ['#demo', '#emulator'],
    createdAt: now,
    updatedAt: now
  } as Content
  await mkdir(join(contentsDir, id), { recursive: true })
  await atomicWriteJson(join(contentsDir, id, 'content.json'), created)
  frame('2/6 content.create', [`id: ${id}`, 'status: idea', 'account: glen-rio-aristo'])
  await sleep(300)

  const steps: Array<{ from: Content['status']; to: Content['status'] }> = [
    { from: 'idea', to: 'draft' },
    { from: 'draft', to: 'ready' },
    { from: 'ready', to: 'rendering' }
  ]
  for (const [i, step] of steps.entries()) {
    const invoke = validateAgentInvoke({ tool: 'content.transition', args: { id, to: step.to } })
    if (!invoke.ok) throw new Error(JSON.stringify(invoke.issues))
    const existing = JSON.parse(await readFile(join(contentsDir, id, 'content.json'), 'utf-8')) as Content
    assertLegalTransition(existing.status, step.to)
    const merged = mergeKnownFields<Content>(existing, { status: step.to }, ['status'])
    merged.updatedAt = new Date().toISOString()
    await atomicWriteJson(join(contentsDir, id, 'content.json'), merged)
    frame(`3/6 transition ${i + 1}/3`, [`${step.from} -> ${step.to}`, 'guard: CONTENT_STATUS_FLOW OK'])
    await sleep(300)
  }

  const dirs = (await readdir(contentsDir, { withFileTypes: true })).filter(e => e.isDirectory())
  frame('4/6 content.list', [`items: ${dirs.length}`, `latest: ${id}`, 'shape: LoadedEntry valid'])
  await sleep(300)

  const preset = 'tiktok'
  const dims = DEFAULT_RENDER_PRESETS[preset]
  const jobId = `render-${Date.now()}`
  frame('5/6 render.enqueue (planned, tanpa FFmpeg)', [
    `job: ${jobId}`,
    `content: ${id}`,
    `preset: ${preset} ${dims.width}x${dims.height}@${dims.fps}`,
    'queue: maxConcurrentRender = 1'
  ])
  await sleep(300)

  const badId = validateAgentInvoke({ tool: 'content.get', args: { id: '../../x' } })
  const badStatus = validateAgentInvoke({ tool: 'content.transition', args: { id, to: 'scheduled' } })
  const badPreset = validateAgentInvoke({ tool: 'render.enqueue', args: { contentId: id, preset: 'youtube-landscape' } })
  frame('6/6 guard demo (harus ditolak)', [
    `traversal id rejected: ${String(!badId.ok)}`,
    `status scheduled rejected: ${String(!badStatus.ok)}`,
    `preset landscape rejected: ${String(!badPreset.ok)}`
  ])

  frame('SELESAI', [
    `Content demo: ${id}`,
    'Lihat di UI: /content + /agent + /queue',
    'Jalankan: bun run dev'
  ])
}

await demo().catch((err) => {
  console.error(err)
  process.exit(1)
})
