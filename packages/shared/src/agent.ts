import type { ContentStatus, RenderPreset } from './index'

/**
 * Agent tool contract for Social Content Studio.
 * Adapted governance from dokumenpembelajaran:
 * - contract-first: this file is the canonical tool manifest (cf. TAD 11.1);
 * - no arbitrary filesystem access: tools expose intent, main confines paths;
 * - no `any` on the critical path; total validators that never throw.
 */

export type AgentSideEffect = 'read' | 'write'

export interface AgentToolInputField {
  name: string
  required: boolean
  kind: 'string' | 'number' | 'boolean' | 'string-array' | 'record'
  description: string
}

export interface AgentToolDef {
  /** Stable tool id, e.g. `content.list`. One FR = one tool family. */
  name: string
  description: string
  sideEffect: AgentSideEffect
  /** Backing IPC channel (must exist in preload bridge). */
  channel: string
  inputs: AgentToolInputField[]
}

export const AGENT_TOOLS: readonly AgentToolDef[] = [
  {
    name: 'content.list',
    description: 'List content entries as LoadedEntry items.',
    sideEffect: 'read',
    channel: 'workspace:get-contents',
    inputs: [
      { name: 'filters', required: false, kind: 'record', description: 'Optional accountId/status filter.' }
    ]
  },
  {
    name: 'content.get',
    description: 'Get one content entry by server-generated id.',
    sideEffect: 'read',
    channel: 'workspace:get-content',
    inputs: [{ name: 'id', required: true, kind: 'string', description: 'Content id (SAFE_ID).' }]
  },
  {
    name: 'content.create',
    description: 'Create a content draft (status starts at idea).',
    sideEffect: 'write',
    channel: 'workspace:create-content',
    inputs: [
      { name: 'title', required: true, kind: 'string', description: 'Content title.' },
      { name: 'accountId', required: true, kind: 'string', description: 'Owning account id.' },
      { name: 'templateId', required: false, kind: 'string', description: 'Optional template id.' }
    ]
  },
  {
    name: 'content.transition',
    description: 'Move content status through the legal CONTENT_STATUS_FLOW.',
    sideEffect: 'write',
    channel: 'workspace:update-content',
    inputs: [
      { name: 'id', required: true, kind: 'string', description: 'Content id (SAFE_ID).' },
      { name: 'to', required: true, kind: 'string', description: 'Target ContentStatus.' }
    ]
  },
  {
    name: 'template.list',
    description: 'List template definitions as LoadedEntry items.',
    sideEffect: 'read',
    channel: 'workspace:get-templates',
    inputs: []
  },
  {
    name: 'render.enqueue',
    description: 'Enqueue a render job through the queue.',
    sideEffect: 'write',
    channel: 'render:start',
    inputs: [
      { name: 'contentId', required: true, kind: 'string', description: 'Content id to render.' },
      { name: 'preset', required: false, kind: 'string', description: 'RenderPreset name.' }
    ]
  },
  {
    name: 'render.jobs',
    description: 'List render queue jobs.',
    sideEffect: 'read',
    channel: 'render:jobs',
    inputs: []
  },
  {
    name: 'workspace.backupInfo',
    description: 'Read workspace counts.',
    sideEffect: 'read',
    channel: 'backup:info',
    inputs: []
  }
] as const

export type AgentToolName = (typeof AGENT_TOOLS)[number]['name']

export function getAgentTool(name: string): AgentToolDef | undefined {
  return AGENT_TOOLS.find(t => t.name === name)
}

export interface AgentInvokeRequest {
  tool: string
  args: Record<string, unknown>
}

export interface AgentValidationIssue {
  field: string
  message: string
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const SAFE_ID = /^[A-Za-z0-9._-]+$/

const CONTENT_STATUSES: readonly ContentStatus[] = [
  'idea', 'draft', 'ready', 'rendering', 'ready-to-post', 'posted', 'failed'
]

const RENDER_PRESETS: readonly RenderPreset[] = [
  'instagram-reels', 'tiktok', 'youtube-shorts'
]

/**
 * Total validator for agent invocations. Never throws; returns issues.
 * Enforces SAFE_ID for id-bearing tools and closed vocabularies.
 */
export function validateAgentInvoke(raw: unknown): { ok: true; value: AgentInvokeRequest } | { ok: false; issues: AgentValidationIssue[] } {
  if (!isObject(raw)) {
    return { ok: false, issues: [{ field: '$', message: 'Invoke request must be an object' }] }
  }
  const issues: AgentValidationIssue[] = []
  const tool = raw.tool
  const args = raw.args
  if (typeof tool !== 'string' || tool.length === 0) {
    issues.push({ field: 'tool', message: 'tool must be a non-empty string' })
  }
  if (!isObject(args)) {
    issues.push({ field: 'args', message: 'args must be an object' })
  }
  if (issues.length > 0) return { ok: false, issues }
  const def = getAgentTool(tool as string)
  if (!def) {
    return { ok: false, issues: [{ field: 'tool', message: `unknown tool: ${tool as string}` }] }
  }
  const a = args as Record<string, unknown>
  for (const field of def.inputs) {
    const v = a[field.name]
    if (v === undefined || v === null) {
      if (field.required) issues.push({ field: `args.${field.name}`, message: `${field.name} is required` })
      continue
    }
    if (field.kind === 'string' && typeof v !== 'string') {
      issues.push({ field: `args.${field.name}`, message: `${field.name} must be a string` })
    }
    if (field.kind === 'number' && typeof v !== 'number') {
      issues.push({ field: `args.${field.name}`, message: `${field.name} must be a number` })
    }
    if (field.kind === 'boolean' && typeof v !== 'boolean') {
      issues.push({ field: `args.${field.name}`, message: `${field.name} must be a boolean` })
    }
    if (field.kind === 'string-array' && (!Array.isArray(v) || !v.every(e => typeof e === 'string'))) {
      issues.push({ field: `args.${field.name}`, message: `${field.name} must be a string array` })
    }
    if (field.kind === 'record' && !isObject(v)) {
      issues.push({ field: `args.${field.name}`, message: `${field.name} must be an object` })
    }
  }
  if (def.name === 'content.get' || def.name === 'content.transition') {
    const id = a['id']
    if (typeof id === 'string' && (!SAFE_ID.test(id) || id.includes('..'))) {
      issues.push({ field: 'args.id', message: 'id must match SAFE_ID without traversal' })
    }
  }
  if (def.name === 'content.transition') {
    const to = a['to']
    if (typeof to === 'string' && !(CONTENT_STATUSES as readonly string[]).includes(to)) {
      issues.push({ field: 'args.to', message: `to must be one of ${CONTENT_STATUSES.join(', ')}` })
    }
  }
  if (def.name === 'render.enqueue') {
    const cid = a['contentId']
    if (typeof cid === 'string' && (!SAFE_ID.test(cid) || cid.includes('..'))) {
      issues.push({ field: 'args.contentId', message: 'contentId must match SAFE_ID without traversal' })
    }
    const preset = a['preset']
    if (preset !== undefined && typeof preset === 'string' && !(RENDER_PRESETS as readonly string[]).includes(preset)) {
      issues.push({ field: 'args.preset', message: `preset must be one of ${RENDER_PRESETS.join(', ')}` })
    }
  }
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: { tool: tool as string, args: a } }
}

