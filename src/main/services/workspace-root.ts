import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { logInfo } from '../errors'
import { createAppError } from '../../../packages/shared/src/errors'

const SETTINGS_PATH = join(process.cwd(), 'workspace', 'config', 'settings.json')

/**
 * Single source of truth for the Workspace Root (Spec REQ-004 / CON-002).
 *
 * Resolution rules (REQ-004 / AC-008):
 *  - No settings file yet  → fall back to the legacy `cwd/workspace` (fresh install).
 *  - `workspacePath` configured AND exists as a directory → use it.
 *  - `workspacePath` configured but missing/invalid → THROW. We must not silently
 *    fall back to a different root, because the configured path is a user-chosen
 *    blast radius; the caller surfaces a guided/error state instead.
 */
export function getWorkspaceRoot(): string {
  let configured: string | undefined
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as { workspacePath?: string }
    if (parsed && typeof parsed.workspacePath === 'string' && parsed.workspacePath.length > 0) {
      configured = parsed.workspacePath
    }
  } catch {
    // no settings yet — fall through to default
  }

  if (!configured) {
    const fallback = join(process.cwd(), 'workspace')
    logInfo(`Workspace root: no configured path, using default ${fallback}`)
    return fallback
  }

  try {
    if (!existsSync(configured) || !statSync(configured).isDirectory()) {
      throw createAppError(
        'FS_NOT_FOUND',
        `Configured workspace folder does not exist: ${configured}`,
        'main'
      )
    }
  } catch (err) {
    throw createAppError(
      'FS_NOT_FOUND',
      `Invalid configured workspace folder: ${configured}`,
      'main'
    )
  }

  return configured
}
