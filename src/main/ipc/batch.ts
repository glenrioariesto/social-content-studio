import { join } from 'path'
import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { logInfo } from '../errors'

interface BatchRow {
  title: string
  caption?: string
  hashtags?: string
  resourcePath?: string
  templateId?: string
  scheduledAt?: string
}

function parseCSV(raw: string): BatchRow[] {
  const lines = raw.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const rows: BatchRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })
    rows.push({
      title: row['title'] || `Batch ${i}`,
      caption: row['caption'],
      hashtags: row['hashtags'],
      resourcePath: row['resourcepath'] || row['resource'],
      templateId: row['templateid'] || row['template'],
      scheduledAt: row['scheduledat'] || row['schedule']
    })
  }
  return rows
}

export function initBatchIpc(): void {
  const ws = join(process.cwd(), 'workspace')

  const { safeIpcMain } = require('./safe-handler') as typeof import('./safe-handler')

  safeIpcMain('batch:parse-csv', async (_event: any, csvPath: string) => {
    const raw = await readFile(csvPath, 'utf-8')
    const rows = parseCSV(raw)
    logInfo(`Batch CSV parsed: ${rows.length} rows from ${csvPath}`)
    return { success: true, data: { count: rows.length, rows } }
  }, 'FS_READ_ERROR')

  safeIpcMain('batch:create-content', async (_event: any, accountId: string, rows: BatchRow[], templateId?: string) => {
    const contentDir = join(ws, 'contents')
    const created: string[] = []

    for (const row of rows) {
      const id = `cnt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const content = {
        id,
        title: row.title,
        description: '',
        status: 'draft' as const,
        accountId,
        templateId: row.templateId || templateId,
        resourcePath: row.resourcePath,
        caption: row.caption,
        hashtags: row.hashtags ? row.hashtags.split('#').filter(Boolean).map(h => `#${h.trim()}`) : [],
        scheduledAt: row.scheduledAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      await writeFile(join(contentDir, `${id}.json`), JSON.stringify(content, null, 2), 'utf-8')
      created.push(id)
    }

    logInfo(`Batch created ${created.length} content items for account ${accountId}`)
    return { success: true, data: { ids: created, count: created.length } }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('batch:enqueue-all', async (_event: any, contentIds: string[], preset?: string) => {
    const contentDir = join(ws, 'contents')
    let queued = 0

    for (const id of contentIds) {
      try {
        const raw = await readFile(join(contentDir, `${id}.json`), 'utf-8')
        const content = JSON.parse(raw)
        if (content.status === 'draft' || content.status === 'ready') {
          content.status = 'rendering'
          content.updatedAt = new Date().toISOString()
          await writeFile(join(contentDir, `${id}.json`), JSON.stringify(content, null, 2), 'utf-8')
          queued++
        }
      } catch {
        // skip missing content
      }
    }

    logInfo(`Batch enqueued ${queued} items for rendering`)
    return { success: true, data: { queued } }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('batch:export-csv', async (_event: any, outputPath: string) => {
    const contentDir = join(ws, 'contents')
    const entries = await readdir(contentDir)
    const rows = ['title,caption,hashtags,status,accountId,createdAt']

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      try {
        const raw = await readFile(join(contentDir, entry), 'utf-8')
        const c = JSON.parse(raw)
        rows.push([
          `"${(c.title || '').replace(/"/g, '""')}"`,
          `"${(c.caption || '').replace(/"/g, '""')}"`,
          `"${(c.hashtags || []).join(' ')}"`,
          c.status,
          c.accountId,
          c.createdAt
        ].join(','))
      } catch { /* skip */ }
    }

    await writeFile(outputPath, rows.join('\n'), 'utf-8')
    logInfo(`Batch CSV exported: ${outputPath}`)
    return { success: true, data: outputPath }
  }, 'FS_WRITE_ERROR')
}
