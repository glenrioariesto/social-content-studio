import type { Content, Template, Account } from './index'

/**
 * Hand-written type guards (locked decision: no zod). They are pure,
 * synchronous, and TOTAL — they never throw. A parsed document is either
 * returned as its typed value or rejected with a list of structured issues,
 * letting the caller decide how to present it.
 */

export interface ValidationIssue {
  /** Dotted path to the offending field, e.g. "account.workflows[2].id". */
  field: string
  message: string
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] }

const CONTENT_STATUSES: readonly Content['status'][] = [
  'idea',
  'draft',
  'ready',
  'rendering',
  'ready-to-post',
  'posted',
  'failed'
]

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}
function isString(v: unknown): v is string {
  return typeof v === 'string'
}

export function validateContent(raw: unknown): ValidationResult<Content> {
  const issues: ValidationIssue[] = []
  if (!isObject(raw)) {
    return { ok: false, issues: [{ field: '$', message: 'Content must be an object' }] }
  }
  if (!isNonEmptyString(raw.id)) {
    issues.push({ field: 'id', message: 'id must be a non-empty string' })
  }
  if (!isNonEmptyString(raw.accountId)) {
    issues.push({ field: 'accountId', message: 'accountId must be a non-empty string' })
  }
  if (!isNonEmptyString(raw.createdAt)) {
    issues.push({ field: 'createdAt', message: 'createdAt must be a non-empty string' })
  }
  if (!isNonEmptyString(raw.updatedAt)) {
    issues.push({ field: 'updatedAt', message: 'updatedAt must be a non-empty string' })
  }
  if (typeof raw.status !== 'string' || !CONTENT_STATUSES.includes(raw.status as Content['status'])) {
    issues.push({ field: 'status', message: `status must be one of ${CONTENT_STATUSES.join(', ')}` })
  }
  // Structural sanity of optional fields (only when present).
  if (raw.title !== undefined && !isString(raw.title)) {
    issues.push({ field: 'title', message: 'title must be a string' })
  }
  if (raw.description !== undefined && !isString(raw.description)) {
    issues.push({ field: 'description', message: 'description must be a string' })
  }
  if (raw.templateId !== undefined && !isString(raw.templateId)) {
    issues.push({ field: 'templateId', message: 'templateId must be a string' })
  }
  if (raw.hashtags !== undefined && !Array.isArray(raw.hashtags)) {
    issues.push({ field: 'hashtags', message: 'hashtags must be an array' })
  }
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: raw as unknown as Content }
}

export function validateTemplate(raw: unknown): ValidationResult<Template> {
  const issues: ValidationIssue[] = []
  if (!isObject(raw)) {
    return { ok: false, issues: [{ field: '$', message: 'Template must be an object' }] }
  }
  if (!isNonEmptyString(raw.id)) {
    issues.push({ field: 'id', message: 'id must be a non-empty string' })
  }
  if (!isNonEmptyString(raw.name)) {
    issues.push({ field: 'name', message: 'name must be a non-empty string' })
  }
  if (!isNonEmptyString(raw.type)) {
    issues.push({ field: 'type', message: 'type must be a non-empty string' })
  }
  if (!isObject(raw.input)) {
    issues.push({ field: 'input', message: 'input must be an object' })
  }
  if (!isObject(raw.output)) {
    issues.push({ field: 'output', message: 'output must be an object' })
  }
  if (raw.variables !== undefined && !Array.isArray(raw.variables)) {
    issues.push({ field: 'variables', message: 'variables must be an array' })
  }
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: raw as unknown as Template }
}

export function validateAccount(raw: unknown): ValidationResult<Account> {
  const issues: ValidationIssue[] = []
  if (!isObject(raw)) {
    return { ok: false, issues: [{ field: '$', message: 'Account must be an object' }] }
  }
  if (!isNonEmptyString(raw.id)) {
    issues.push({ field: 'id', message: 'id must be a non-empty string' })
  }
  if (!isNonEmptyString(raw.name)) {
    issues.push({ field: 'name', message: 'name must be a non-empty string' })
  }
  if (raw.description !== undefined && !isString(raw.description)) {
    issues.push({ field: 'description', message: 'description must be a string' })
  }
  if (raw.workflows !== undefined && !Array.isArray(raw.workflows)) {
    issues.push({ field: 'workflows', message: 'workflows must be an array' })
  }
  if (raw.templates !== undefined && !Array.isArray(raw.templates)) {
    issues.push({ field: 'templates', message: 'templates must be an array' })
  }
  if (raw.branding !== undefined && !isObject(raw.branding)) {
    issues.push({ field: 'branding', message: 'branding must be an object' })
  }
  // branding.logo: optional; when present and non-empty it must point inside
  // the account's assets dir with an allowed image extension. Legacy empty
  // string is accepted as absent (Audit FINDING-B).
  const logo = isObject(raw.branding) ? raw.branding.logo : undefined
  if (logo !== undefined && logo !== '' && !isString(logo)) {
    issues.push({ field: 'branding.logo', message: 'logo must be a string' })
  } else if (typeof logo === 'string' && logo !== '') {
    const LOGO_PATTERN = /^assets\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|svg)$/
    if (!LOGO_PATTERN.test(logo)) {
      issues.push({ field: 'branding.logo', message: 'logo must be an assets/ path ending in .png/.jpg/.jpeg/.webp/.svg' })
    }
  }
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: raw as unknown as Account }
}
