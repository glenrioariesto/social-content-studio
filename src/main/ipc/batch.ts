import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import { logInfo } from '@main/errors'
import { safeIpcMain } from './safe-handler'
import { assertSafeId } from './ipc-handler'
import { loadDirEntries } from './filesystem'
import { assertInsideWorkspace } from '@main/services/path-guard'
import { getWorkspaceRoot } from '@main/services/workspace-root'
import { assertLegalTransition } from '@main/services/lifecycle'
import { generateUniqueContentId } from '@main/services/id'
import { atomicWriteJson, mergeKnownFields } from '@main/services/persistence'
import { renderQueue } from '@main/services/render-queue'
import { DEFAULT_RENDER_PRESETS, type Content } from '@shared/index'
import { validateContent } from '@shared/validators'
import { createAppError } from '@shared/errors'

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
  const ws = () => getWorkspaceRoot()

  /** Confines a renderer-supplied path to the workspace root (PRN-001). */
  function confineBatchPath(channel: string, candidate: string): string {
    return assertInsideWorkspace(ws(), candidate, channel).absolute
  }

  safeIpcMain('batch:parse-csv', async (_event: any, csvPath: string) => {
    const confinedCsv = confineBatchPath('batch:parse-csv', csvPath)
    const raw = await readFile(confinedCsv, 'utf-8')
    const rows = parseCSV(raw)
    logInfo(`Batch CSV parsed: ${rows.length} rows from ${confinedCsv}`)
    return { success: true, data: { count: rows.length, rows } }
  }, 'FS_READ_ERROR')

  safeIpcMain('batch:create-content', async (_event: any, accountId: string, rows: BatchRow[], templateId?: string) => {
    const contentsDir = join(ws(), 'contents')
    const created: string[] = []

    for (const row of rows) {
      const id = generateUniqueContentId(contentsDir)
      await mkdir(join(contentsDir, id), { recursive: true })
      const now = new Date().toISOString()
      const content: Content = {
        id,
        title: row.title,
        description: '',
        status: 'draft',
        accountId,
        templateId: row.templateId || templateId,
        resourcePath: row.resourcePath,
        caption: row.caption,
        hashtags: row.hashtags ? row.hashtags.split('#').filter(Boolean).map(h => `#${h.trim()}`) : [],
        scheduledAt: row.scheduledAt,
        createdAt: now,
        updatedAt: now
      } as Content
      await atomicWriteJson(join(contentsDir, id, 'content.json'), content)
      created.push(id)
    }

    logInfo(`Batch created ${created.length} content items for account ${accountId}`)
    return { success: true, data: { ids: created, count: created.length } }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('batch:enqueue-all', async (_event: any, contentIds: string[], preset?: string) => {
    const root = ws()
    let added = 0

    for (const id of contentIds) {
      try {
        assertSafeId(id, 'batch:enqueue-all')
        const jsonPath = join(root, 'contents', id, 'content.json')
        const existing = JSON.parse(await readFile(jsonPath, 'utf-8')) as Content

        // SYNC with TASK-202: reject enqueue when a render is already active for this content.
        const active = renderQueue.getActiveJobs().find((j) => j.contentId === id)
        if (active) {
          throw createAppError('RENDER_FAILED', `A render job is already active for content ${id} (job ${active.id})`, 'ipc', { contentId: id })
        }

        // REQ-006: walk the legal flow (draft -> ready -> rendering). Never
        // mutate status beyond the transition guard.
        let doc = existing
        if (doc.status === 'draft') {
          assertLegalTransition(doc.status, 'ready')
          doc = mergeKnownFields<Content>(doc, { status: 'ready' }, ['status'])
          doc.updatedAt = new Date().toISOString()
          await atomicWriteJson(jsonPath, doc)
        }
        assertLegalTransition(doc.status, 'rendering')
        doc = mergeKnownFields<Content>(doc, { status: 'rendering' }, ['status'])
        doc.updatedAt = new Date().toISOString()
        await atomicWriteJson(jsonPath, doc)

        const dims = DEFAULT_RENDER_PRESETS[(preset as keyof typeof DEFAULT_RENDER_PRESETS) ?? 'instagram-reels']
        await renderQueue.addJob({
          id: randomUUID(),
          contentId: id,
          options: {
            inputPath: doc.resourcePath ?? id,
            outputPath: join(root, 'contents', id, 'output.mp4'),
            width: dims?.width,
            height: dims?.height,
            fps: dims?.fps,
            preset: 'medium'
          }
        })
        added++
      } catch {
        // skip content that is missing, non-transitionable, or already rendering
      }
    }

    logInfo(`Batch added ${added} items for rendering`)
    return { success: true, data: { added } }
  }, 'FS_WRITE_ERROR')

  safeIpcMain('batch:export-csv', async (_event: any, outputPath: string) => {
    const root = ws()
    // PRN-001: confine the output path before writing.
    const confinedOutput = confineBatchPath('batch:export-csv', outputPath)
    const entries = await loadDirEntries<Content>(root, 'contents', 'content.json', validateContent)
    const rows = ['title,caption,hashtags,status,accountId,createdAt']

    for (const entry of entries) {
      if (entry.kind !== 'valid') continue
      const c = entry.data
      rows.push([
        `"${(c.title || '').replace(/"/g, '""')}"`,
        `"${(c.caption || '').replace(/"/g, '""')}"`,
        `"${(c.hashtags || []).join(' ')}"`,
        c.status,
        c.accountId,
        c.createdAt
      ].join(','))
    }

    await writeFile(confinedOutput, rows.join('\n'), 'utf-8')
    logInfo(`Batch CSV exported: ${confinedOutput}`)
    return { success: true, data: confinedOutput }
  }, 'FS_WRITE_ERROR')
}
