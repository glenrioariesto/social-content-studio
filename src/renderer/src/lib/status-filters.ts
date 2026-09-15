import { CONTENT_STATUSES, CONTENT_STATUS_FLOW, type ContentStatus } from '@shared/index'

export type StatusFilterValue = ContentStatus | 'all'

export interface StatusOption {
  label: string
  value: StatusFilterValue
}

const STATUS_LABELS: Record<ContentStatus, string> = {
  'idea': 'Idea',
  'draft': 'Draft',
  'ready': 'Ready',
  'rendering': 'Rendering',
  'ready-to-post': 'Ready to Post',
  'posted': 'Posted',
  'failed': 'Failed'
}

export function statusToLabel(status: ContentStatus): string {
  return STATUS_LABELS[status] ?? status
}

export function buildStatusOptions(): StatusOption[] {
  return [
    { label: 'All statuses', value: 'all' },
    ...CONTENT_STATUSES.map(status => ({ label: statusToLabel(status), value: status }))
  ]
}

export function allowedNextStatuses(status: ContentStatus): ContentStatus[] {
  return CONTENT_STATUS_FLOW[status] ?? []
}