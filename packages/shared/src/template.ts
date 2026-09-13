export interface TemplateVariable {
  name: string
  type: 'text' | 'image' | 'color' | 'number'
  default?: string
  label: string
}

export interface TemplateLayer {
  id: string
  type: 'background' | 'video' | 'overlay' | 'logo' | 'text' | 'subtitle' | 'cta' | 'watermark'
  file?: string
  text?: string
  position: { x: number; y: number }
  size?: { width: number; height: number }
  opacity: number
  zIndex: number
  style?: Record<string, string>
}

import type { TemplateType } from './domain'

export interface TemplateDefinition {
  id: string
  name: string
  type: TemplateType
  accountId?: string
  category?: string
  description?: string
  input: { type: 'video' | 'image' | 'html' }
  output: { width: number; height: number; fps: number }
  overlay?: { file: string; position: string }
  audio?: { enabled: boolean }
  variables?: TemplateVariable[]
  layers?: TemplateLayer[]
  createdAt?: string
  updatedAt?: string
}

export function interpolateTemplate(html: string, data: Record<string, string>): string {
  let result = html
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(regex, value ?? '')
  }
  return result
}

export function extractVariables(html: string): string[] {
  const matches = html.match(/\{\{\s*(\w+)\s*\}\}/g) || []
  return [...new Set(matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, '')))]
}

export const ACCOUNT_COLORS: Record<string, string> = {
  'glen-rio-aristo': 'bg-purple-600',
  'jacksonlab': 'bg-blue-600',
  'highproduct': 'bg-emerald-600'
}
