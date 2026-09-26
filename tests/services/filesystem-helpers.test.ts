import { describe, it, expect, mock } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

mock.module('electron', () => ({
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: { showOpenDialog: async () => ({ canceled: true }) },
  safeStorage: { isEncryptionAvailable: () => false },
  shell: { openPath: async () => '' },
  app: { on: () => {}, getPath: () => '' },
  BrowserWindow: class {}
}))

const { loadDirEntries, filterContentEntries } = await import('../../src/main/ipc/filesystem')

async function withTmpWs<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'ws-'))
  try {
    return await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('filesystem shared helpers', () => {
  it('loadDirEntries loads one document per sub-directory', async () => {
    await withTmpWs(async (root) => {
      await mkdir(join(root, 'contents', 'abc'), { recursive: true })
      await mkdir(join(root, 'contents', 'def'), { recursive: true })
      await writeFile(
        join(root, 'contents', 'abc', 'content.json'),
        JSON.stringify({ id: 'abc', title: 'A', status: 'idea', accountId: 'a', createdAt: '1', updatedAt: '1' }),
        'utf-8'
      )
      await writeFile(
        join(root, 'contents', 'def', 'content.json'),
        JSON.stringify({ id: 'def', title: 'D', status: 'draft', accountId: 'b', createdAt: '1', updatedAt: '1' }),
        'utf-8'
      )

      const { validateContent } = await import('../../packages/shared/src/validators')
      const entries = await loadDirEntries<{ id: string; title: string; status: string; accountId: string }>(
        root,
        'contents',
        'content.json',
        validateContent
      )
      expect(entries).toHaveLength(2)
      const ids = entries.map(e => e.id).sort()
      expect(ids).toEqual(['abc', 'def'])
      expect(entries.every(e => e.kind === 'valid')).toBe(true)
    })
  })

  it('loadDirEntries tolerates a missing directory and reports invalid docs', async () => {
    await withTmpWs(async (root) => {
      const { validateContent } = await import('../../packages/shared/src/validators')
      const empty = await loadDirEntries(root, 'nope', 'content.json', validateContent)
      expect(empty).toEqual([])

      await mkdir(join(root, 'contents', 'broken'), { recursive: true })
      await writeFile(join(root, 'contents', 'broken', 'content.json'), '{not json', 'utf-8')
      const entries = await loadDirEntries(root, 'contents', 'content.json', validateContent)
      expect(entries).toHaveLength(1)
      expect(entries[0].kind).toBe('invalid')
    })
  })

  it('filterContentEntries filters by accountId and status and keeps invalid entries', async () => {
    const base = (id: string, accountId: string, status: string) => ({
      kind: 'valid' as const,
      id,
      data: { id, accountId, status }
    })
    const all = [
      base('1', 'acct-a', 'idea'),
      base('2', 'acct-a', 'draft'),
      base('3', 'acct-b', 'draft'),
      { kind: 'invalid' as const, id: '9', file: '/x', issues: [{ field: '$', message: 'bad' }] }
    ]

    const byAccount = filterContentEntries(all, { accountId: 'acct-a' })
    expect(byAccount.map(e => e.id).sort()).toEqual(['1', '2'])

    const byStatus = filterContentEntries(all, { status: 'draft' })
    expect(byStatus.map(e => e.id).sort()).toEqual(['2', '3'])

    const combined = filterContentEntries(all, { accountId: 'acct-b', status: 'draft' })
    expect(combined.map(e => e.id)).toEqual(['3'])

    expect(filterContentEntries(all, undefined)).toEqual(all)
  })
})