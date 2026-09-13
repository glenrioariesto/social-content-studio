import { rm, cp } from 'fs/promises'
import { join } from 'path'

const ROOT = join(import.meta.dir, '..')
const SRC = join(ROOT, 'node_modules', 'monaco-editor', 'min', 'vs')
const DEST = join(ROOT, 'src', 'renderer', 'public', 'vs')

await rm(DEST, { recursive: true, force: true })
await cp(SRC, DEST, { recursive: true })
console.log(`Copied monaco-editor/min/vs -> src/renderer/public/vs`)