import type { ValidationIssue } from './validators'

/**
 * Honest read shape: a loaded document is either valid (carrying its parsed
 * data) or invalid (carrying the offending file path and the structured issues).
 * Invalid entries are NEVER replaced by fabricated defaults at read boundaries.
 */
export type LoadedEntry<T> =
  | { kind: 'valid'; id: string; data: T }
  | { kind: 'invalid'; id: string; file: string; issues: ValidationIssue[] }
