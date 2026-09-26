import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

import { createAppError } from '@shared/errors'

/** Bootstrap settings file — always lives at cwd/workspace, regardless of configured workspacePath. */
export const BOOTSTRAP_SETTINGS_PATH = join(process.cwd(), 'workspace', 'config', 'settings.json')

let testWorkspaceRoot: string | null = null
let testBootstrapSettingsPath: string | null = null

export function _setTestWorkspaceRoot(root: string | null | undefined): void {
  testWorkspaceRoot = root || null
}

export function _setTestBootstrapSettingsPath(path: string | null | undefined): void {
  testBootstrapSettingsPath = path || null
}

export function getBootstrapSettingsPath(): string {
  return testBootstrapSettingsPath || BOOTSTRAP_SETTINGS_PATH
}

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
  if (testWorkspaceRoot) {
    return testWorkspaceRoot
  }
  const settingsPath = testBootstrapSettingsPath || BOOTSTRAP_SETTINGS_PATH
  let configured: string | undefined
  try {
    const raw = readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw) as { workspacePath?: string }
    if (parsed && typeof parsed.workspacePath === 'string' && parsed.workspacePath.length > 0) {
      configured = parsed.workspacePath
    }
  } catch {
    // no settings yet — fall through to default
  }

  if (!configured) {
    const fallback = join(process.cwd(), 'workspace')
    // no longer logging here to prevent infinite recursion with logDir()
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
