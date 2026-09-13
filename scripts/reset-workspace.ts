import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'

const BASE = join(import.meta.dir, '..', 'workspace')

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

async function reset() {
  console.log(`Resetting workspace at ${BASE} (contents + renders only)...`)
  for (const dir of [join(BASE, 'contents'), join(BASE, 'renders')]) {
    try {
      const entries = await readdir(dir)
      for (const entry of entries) {
        await rm(join(dir, entry), { recursive: true, force: true })
      }
    } catch {
      await ensureDir(dir)
    }
    await ensureDir(dir)
  }
  await writeFile(join(BASE, 'renders', '.gitkeep'), '', 'utf-8').catch(() => {})
  console.log('Workspace contents + renders cleared. Accounts/templates kept.')
}

await reset().catch((err) => {
  console.error(err)
  process.exit(1)
})
