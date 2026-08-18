import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

const BASE = join(import.meta.dir, '..', 'workspace')

const ACCOUNTS = [
  {
    id: 'glen-rio-aristo',
    name: 'Glen Rio Aristo',
    workflows: ['manual-video'],
    templates: ['glen-personal', 'glen-quote', 'glen-talking-head'],
    branding: { logo: '', watermark: '@glenrioaristo' }
  },
  {
    id: 'jacksonlab',
    name: 'JacksonLab',
    workflows: ['internet-video', 'manual-video'],
    templates: ['jacksonlab-news', 'jacksonlab-commentary', 'jacksonlab-tech'],
    branding: { logo: '', watermark: '@jacksonlab' }
  },
  {
    id: 'highproduct',
    name: 'HighProduct',
    workflows: ['product-video', 'manual-video'],
    templates: ['highproduct-showcase', 'highproduct-promo', 'highproduct-review'],
    branding: { logo: '', watermark: '@highproduct' }
  }
]

const SETTINGS = {
  defaultPreset: 'instagram-reels',
  maxConcurrentRender: 1,
  workspacePath: BASE,
  ffmpegPath: undefined
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true })
}

async function writeJSON(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
}

async function init() {
  console.log('Initializing workspace...')

  const dirs = [
    join(BASE, 'accounts'),
    join(BASE, 'resources'),
    join(BASE, 'templates'),
    join(BASE, 'contents'),
    join(BASE, 'renders'),
    join(BASE, 'assets', 'images'),
    join(BASE, 'assets', 'audio'),
    join(BASE, 'assets', 'video'),
    join(BASE, 'assets', 'fonts'),
    join(BASE, 'config')
  ]

  for (const dir of dirs) {
    await ensureDir(dir)
    console.log(`  Created: ${dir.replace(BASE, 'workspace')}`)
  }

  for (const account of ACCOUNTS) {
    const accountDir = join(BASE, 'accounts', account.id)
    await ensureDir(accountDir)
    await writeJSON(join(accountDir, 'account.json'), account)
    console.log(`  Account: ${account.id}`)
  }

  await writeJSON(join(BASE, 'config', 'settings.json'), SETTINGS)
  console.log('  Settings: config/settings.json')

  console.log('\nWorkspace initialized!')
}

init().catch(console.error)
