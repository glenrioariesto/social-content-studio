import type { Account } from './index'

/**
 * Template variable substitution (Flexible Branding / FR-4).
 *
 * Pure and electron-free: takes template HTML and a context and returns HTML
 * with brand variables replaced. Unknown placeholders are left untouched so a
 * partially-migrated template never breaks.
 *
 * Supported variables:
 *   {{account.name}}        → account name
 *   {{account.description}} → account description ('' when absent)
 *   {{account.logo}}        → file:// URL of the logo asset ('' when absent)
 */
export interface TemplateVarContext {
  account?: Pick<Account, 'name' | 'description' | 'branding'>
}

/** Convert a stored relative logo path (`assets/logo.png`) to a file:// URL. */
export function logoToFileUrl(relativePath: string | undefined): string {
  if (!relativePath) return ''
  return 'file://' + relativePath.replace(/^\//, '')
}

export function applyTemplateVariables(html: string, ctx: TemplateVarContext): string {
  const acc = ctx.account
  const values: Record<string, string> = {
    'account.name': acc?.name ?? '',
    'account.description': acc?.description ?? '',
    'account.logo': logoToFileUrl(acc?.branding?.logo)
  }
  return html.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key: string) =>
    key in values ? values[key] : match
  )
}
