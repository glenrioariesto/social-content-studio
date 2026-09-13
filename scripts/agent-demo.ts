import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { generateUniqueContentId } from '../src/main/services/id'
import { atomicWriteJson, mergeKnownFields } from '../src/main/services/persistence'
import { assertLegalTransition } from '../src/main/services/lifecycle'
import { validateAgentInvoke } from '../packages/shared/src/agent'
import type { Content } from '../packages/shared/src/index'

const BASE = join(import.meta.dir, '..', 'workspace')

async function demo() {
  const contentsDir = join(BASE, 'contents')
  await mkdir(contentsDir, { recursive: true })

  // 1. content.create equivalent (server-generated id, atomic write)
  const id = generateUniqueContentId(contentsDir)
  const now = new Date().toISOString()
  const created: Content = {
    id,
    title: 'Agent Demo Content',
    status: 'idea',
    accountId: 'glen-rio-aristo',
    templateId: 'glen-quote',
    createdAt: now,
    updatedAt: now
  } as Content
  await mkdir(join(contentsDir, id), { recursive: true })
  await atomicWriteJson(join(contentsDir, id, 'content.json'), created)
  console.log(`1. created: ${id}`)

  // 2. content.transition idea -> draft (validated invoke + legal transition)
  const invoke = validateAgentInvoke({ tool: 'content.transition', args: { id, to: 'draft' } })
  if (!invoke.ok) throw new Error(`invoke rejected: ${JSON.stringify(invoke.issues)}`)
  const existing = JSON.parse(await readFile(join(contentsDir, id, 'content.json'), 'utf-8')) as Content
  assertLegalTransition(existing.status, 'draft')
  const merged = mergeKnownFields<Content>(existing, { status: 'draft' }, ['status'])
  merged.updatedAt = new Date().toISOString()
  await atomicWriteJson(join(contentsDir, id, 'content.json'), merged)
  console.log(`2. transition: idea -> draft`)

  // 3. content.list equivalent
  const entries = await readdir(contentsDir, { withFileTypes: true })
  console.log(`3. contents on disk: ${entries.filter(e => e.isDirectory()).length} item(s)`)

  // 4. Show seeded detail
  const detail = await readFile(join(contentsDir, id, 'content.json'), 'utf-8')
  await writeFile(join(BASE, 'renders', '.gitkeep'), '', 'utf-8').catch(() => {})
  console.log(`4. detail: ${detail}`)
}

await demo().catch((err) => {
  console.error(err)
  process.exit(1)
})
