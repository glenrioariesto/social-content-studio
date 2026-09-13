import { rm } from 'fs/promises'
import { join } from 'path'

const OUT = join(import.meta.dir, '..', 'out')

await rm(OUT, { recursive: true, force: true })
console.log(`Cleaned ${OUT}`)
