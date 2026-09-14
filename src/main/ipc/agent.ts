import { mkdir, readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { safeIpcMain } from './safe-handler'
import { assertSafeId } from './ipc-handler'
import { loadEntry, loadDirEntries, filterContentEntries } from './filesystem'
import { getWorkspaceRoot } from '@main/services/workspace-root'
import { assertLegalTransition } from '@main/services/lifecycle'
import { generateUniqueContentId } from '@main/services/id'
import { atomicWriteJson, mergeKnownFields } from '@main/services/persistence'
import { renderQueue } from '@main/services/render-queue'
import { logInfo } from '@main/errors'
import { AGENT_TOOLS, validateAgentInvoke, getAgentTool } from '@shared/agent'
import { DEFAULT_RENDER_PRESETS, type Content, type ContentStatus, type Template } from '@shared/index'
import { validateContent, validateTemplate } from '@shared/validators'
import { createAppError } from '@shared/errors'

/**
 * Studio Agent executor (main process).
 * Governance adapted from dokumenpembelajaran TAD 11.1 + AGENTS.md 8:
 * - contract-first: manifest lives in packages/shared/src/agent.ts;
 * - tools expose intent only; all path/id/status rules stay in main;
 * - ambiguous requests halt with OPEN_QUESTIONS-style issues, never guessed.
 */
export function initAgentIpc(): void {
  safeIpcMain('agent:list-tools', async () => {
    return { success: true, data: AGENT_TOOLS }
  }, 'FS_READ_ERROR')

  safeIpcMain('agent:invoke', async (_event, raw: unknown) => {
    const parsed = validateAgentInvoke(raw)
    if (!parsed.ok) {
      throw createAppError('CONTENT_INVALID_STATUS', 'Ambiguous agent request halted', 'ipc', parsed.issues)
    }
    const { tool, args } = parsed.value
    const def = getAgentTool(tool)
    if (!def) throw createAppError('CONTENT_NOT_FOUND', `Unknown tool: ${tool}`, 'ipc', { tool })
    const root = getWorkspaceRoot()
    logInfo(`Agent invoke: ${tool}`)

    if (tool === 'content.list') {
      const filters = (args['filters'] ?? undefined) as Record<string, string> | undefined
      const results = await loadDirEntries<Content>(root, 'contents', 'content.json', validateContent)
      return { success: true, data: filterContentEntries(results, filters) }
    }

    if (tool === 'content.get') {
      const id = args['id'] as string
      assertSafeId(id, 'agent:invoke')
      const entry = await loadEntry<Content>(join(root, 'contents', id, 'content.json'), id, validateContent)
      return { success: true, data: entry }
    }

    if (tool === 'content.create') {
      const contentsDir = join(root, 'contents')
      const id = generateUniqueContentId(contentsDir)
      await mkdir(join(contentsDir, id), { recursive: true })
      const now = new Date().toISOString()
      const content: Content = {
        id,
        createdAt: now,
        updatedAt: now,
        status: 'idea',
        accountId: args['accountId'] as string,
        title: args['title'] as string,
        ...(typeof args['templateId'] === 'string' ? { templateId: args['templateId'] as string } : {})
      } as Content
      await atomicWriteJson(join(contentsDir, id, 'content.json'), content)
      logInfo(`Agent created content: ${id}`)
      return { success: true, data: content }
    }

    if (tool === 'content.transition') {
      const id = args['id'] as string
      const to = args['to'] as ContentStatus
      assertSafeId(id, 'agent:invoke')
      const jsonPath = join(root, 'contents', id, 'content.json')
      const existing = JSON.parse(await readFile(jsonPath, 'utf-8')) as Content
      assertLegalTransition(existing.status, to)
      const merged = mergeKnownFields<Content>(existing, { status: to }, ['status'])
      merged.updatedAt = new Date().toISOString()
      await atomicWriteJson(jsonPath, merged)
      logInfo(`Agent transition: ${id} ${existing.status} -> ${to}`)
      return { success: true, data: merged }
    }

    if (tool === 'template.list') {
      const results = await loadDirEntries<Template>(root, 'templates', 'template.json', validateTemplate)
      return { success: true, data: results }
    }

    if (tool === 'render.enqueue') {
      const contentId = args['contentId'] as string
      const preset = (args['preset'] as string | undefined) ?? 'instagram-reels'
      assertSafeId(contentId, 'agent:invoke')
      const jsonPath = join(root, 'contents', contentId, 'content.json')
      const existing = JSON.parse(await readFile(jsonPath, 'utf-8')) as Content
      assertLegalTransition(existing.status, 'rendering')
      const dims = DEFAULT_RENDER_PRESETS[preset as keyof typeof DEFAULT_RENDER_PRESETS]
      const job = await renderQueue.addJob({
        id: randomUUID(),
        contentId,
        options: {
          inputPath: existing.resourcePath ?? contentId,
          outputPath: join(root, 'contents', contentId, 'output.mp4'),
          width: dims.width,
          height: dims.height,
          fps: dims.fps,
          preset: 'medium'
        }
      })
      const merged = mergeKnownFields<Content>(existing, { status: 'rendering' }, ['status'])
      merged.updatedAt = new Date().toISOString()
      await atomicWriteJson(jsonPath, merged)
      logInfo(`Agent added render job: ${job.id} for ${contentId}`)
      return { success: true, data: { jobId: job.id, contentId, preset } }
    }

    if (tool === 'render.jobs') {
      return { success: true, data: renderQueue.getAllJobs() }
    }

    // workspace.backupInfo
    const dirs = ['accounts', 'contents', 'templates', 'resources', 'assets']
    const info: Record<string, number> = {}
    for (const dir of dirs) {
      try {
        const entries = await readdir(join(root, dir), { withFileTypes: true })
        info[dir] = entries.length
      } catch {
        info[dir] = 0
      }
    }
    return { success: true, data: info }
  }, 'IPC_HANDLER_ERROR')
}
