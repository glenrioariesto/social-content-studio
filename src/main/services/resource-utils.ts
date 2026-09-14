import { basename } from 'path'
import type { Resource } from '@shared/resource'

/** Reduce a user-supplied file name to a safe basename; fallback otherwise. */
export function sanitizeFileName(name: string, fallback: string): string {
  const base = basename(name || '')
  if (!base || base === '.' || base === '..' || base.includes('\\')) return fallback
  return base
}

/** Parse a resource meta file; returns null for corrupt or structurally invalid JSON. */
export function parseResourceMeta(raw: string): Resource | null {
  try {
    const value = JSON.parse(raw) as unknown
    if (typeof value !== 'object' || value === null) return null
    const meta = value as Record<string, unknown>
    if (typeof meta.id !== 'string' || meta.id === '') return null
    return meta as unknown as Resource
  } catch {
    return null
  }
}

/** Allow only http(s) URLs that cannot inject yt-dlp options (no leading dash). */
export function isAllowedDownloadUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) return false
  if (trimmed.startsWith('-')) return false
  return true
}