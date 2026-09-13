import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { generateUniqueContentId } from '../src/main/services/id'

const BASE = join(import.meta.dir, '..', 'workspace')

async function seed() {
  const contentsDir = join(BASE, 'contents')
  await mkdir(contentsDir, { recursive: true })
  const id = generateUniqueContentId(contentsDir)
  const now = new Date().toISOString()
  const content = {
    id,
    title: 'Demo Agent Content',
    description: 'Seeded for Agent Studio testing',
    status: 'ready',
    accountId: 'glen-rio-aristo',
    templateId: 'glen-quote',
    caption: 'Demo caption from seed script',
    hashtags: ['#demo', '#studio'],
    createdAt: now,
    updatedAt: now
  }
  const dir = join(contentsDir, id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'content.json'), JSON.stringify(content, null, 2), 'utf-8')
  console.log(`Seeded content: ${id}`)
  console.log(`Next: bun scripts/agent-demo.ts (uses this id via content.list)`)
}

await seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
