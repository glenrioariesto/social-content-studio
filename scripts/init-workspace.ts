import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

const BASE = join(import.meta.dir, '..', 'workspace')

const ACCOUNTS = [
  {
    id: 'glen-rio-aristo',
    name: 'Glen Rio Aristo',
    workflows: ['manual-video'],
    templates: ['glen-personal', 'glen-quote'],
    branding: { logo: '', watermark: '@glenrioaristo' }
  },
  {
    id: 'jacksonlab',
    name: 'JacksonLab',
    workflows: ['internet-video', 'manual-video'],
    templates: ['jacksonlab-news', 'jacksonlab-commentary'],
    branding: { logo: '', watermark: '@jacksonlab' }
  },
  {
    id: 'highproduct',
    name: 'HighProduct',
    workflows: ['product-video', 'manual-video'],
    templates: ['highproduct-showcase', 'highproduct-promo'],
    branding: { logo: '', watermark: '@highproduct' }
  }
]

const TEMPLATES = [
  {
    id: 'glen-personal',
    name: 'Glen Personal',
    type: 'video-overlay',
    accountId: 'glen-rio-aristo',
    input: { type: 'video' },
    output: { width: 1080, height: 1920, fps: 30 },
    overlay: { file: 'overlay.png', position: 'top-right' },
    audio: { enabled: true },
    variables: ['title', 'brand']
  },
  {
    id: 'glen-quote',
    name: 'Glen Quote',
    type: 'html-template',
    accountId: 'glen-rio-aristo',
    input: { type: 'html' },
    output: { width: 1080, height: 1920, fps: 30 },
    variables: ['quote', 'author', 'brand']
  },
  {
    id: 'jacksonlab-news',
    name: 'JacksonLab News',
    type: 'video-overlay',
    accountId: 'jacksonlab',
    input: { type: 'video' },
    output: { width: 1080, height: 1920, fps: 30 },
    overlay: { file: 'overlay.png', position: 'center' },
    audio: { enabled: true },
    variables: ['headline', 'brand']
  },
  {
    id: 'jacksonlab-commentary',
    name: 'JacksonLab Commentary',
    type: 'video-overlay',
    accountId: 'jacksonlab',
    input: { type: 'video' },
    output: { width: 1080, height: 1920, fps: 30 },
    overlay: { file: 'overlay.png', position: 'bottom' },
    audio: { enabled: true },
    variables: ['title', 'brand']
  },
  {
    id: 'highproduct-showcase',
    name: 'HighProduct Showcase',
    type: 'html-template',
    accountId: 'highproduct',
    input: { type: 'html' },
    output: { width: 1080, height: 1920, fps: 30 },
    variables: ['product', 'price', 'cta', 'brand']
  },
  {
    id: 'highproduct-promo',
    name: 'HighProduct Promo',
    type: 'video-overlay',
    accountId: 'highproduct',
    input: { type: 'video' },
    output: { width: 1080, height: 1920, fps: 30 },
    overlay: { file: 'overlay.png', position: 'center' },
    audio: { enabled: true },
    variables: ['product', 'cta', 'brand']
  }
]

function genHtml(template: any): string {
  const vars = template.variables || []
  const varsHtml = vars.map((v: string) =>
    v === 'brand' ? '' : `    <div class="field"><label>${v}</label><p>{{${v}}}</p></div>`
  ).filter(Boolean).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1080, initial-scale=1.0">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="canvas">
    <div class="overlay">@${template.accountId || 'brand'}</div>
    <div class="main-content">
${varsHtml || '      <h1 class="title">{{title}}</h1>'}
    </div>
    <div class="watermark">{{brand}}</div>
  </div>
</body>
</html>`
}

function genCss(): string {
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1080px; height: 1920px; overflow: hidden; font-family: 'Inter', system-ui, sans-serif; }
.canvas {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 60px 40px; color: white; position: relative;
}
.overlay {
  position: absolute; top: 40px; left: 40px;
  background: rgba(99, 102, 241, 0.9); color: white;
  padding: 8px 20px; border-radius: 8px; font-size: 24px; font-weight: 700;
}
.main-content { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 30px; }
.field label { font-size: 18px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em; }
.field p { font-size: 56px; font-weight: 700; line-height: 1.2; }
.title { font-size: 72px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; }
.watermark { font-size: 20px; color: rgba(255,255,255,0.4); text-align: right; }`
}

const SETTINGS = {
  defaultPreset: 'instagram-reels',
  maxConcurrentRender: 1,
  workspacePath: BASE,
  ffmpegPath: undefined
}

async function ensureDir(dir: string) { await mkdir(dir, { recursive: true }) }
async function writeJSON(path: string, data: unknown) { await writeFile(path, JSON.stringify(data, null, 2), 'utf-8') }

async function init() {
  console.log('Initializing workspace...')

  const dirs = [
    join(BASE, 'accounts'), join(BASE, 'resources'), join(BASE, 'templates'),
    join(BASE, 'contents'), join(BASE, 'renders'),
    join(BASE, 'assets', 'images'), join(BASE, 'assets', 'audio'),
    join(BASE, 'assets', 'video'), join(BASE, 'assets', 'fonts'),
    join(BASE, 'config')
  ]
  for (const dir of dirs) { await ensureDir(dir) }

  for (const account of ACCOUNTS) {
    const dir = join(BASE, 'accounts', account.id)
    await ensureDir(dir)
    await writeJSON(join(dir, 'account.json'), account)
    console.log(`  Account: ${account.id}`)
  }

  for (const template of TEMPLATES) {
    const dir = join(BASE, 'templates', template.id)
    await ensureDir(dir)
    await writeJSON(join(dir, 'template.json'), template)
    await writeFile(join(dir, 'index.html'), genHtml(template), 'utf-8')
    await writeFile(join(dir, 'style.css'), genCss(), 'utf-8')
    console.log(`  Template: ${template.id}`)
  }

  await writeJSON(join(BASE, 'config', 'settings.json'), SETTINGS)
  console.log('\nWorkspace initialized with accounts + templates!')
}

init().catch(console.error)
