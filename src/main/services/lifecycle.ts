import { CONTENT_STATUS_FLOW } from '../../../packages/shared/src/index'
import type { ContentStatus } from '../../../packages/shared/src/index'
import { createAppError } from '../../../packages/shared/src/errors'

/**
 * Enforces the single content status flow. Any transition not listed in
 * CONTENT_STATUS_FLOW is refused with an explanatory error naming both
 * statuses (Spec REQ-006 / AC-011). Render-driven transitions remain automatic
 * and are checked through this same guard.
 */
export function assertLegalTransition(from: ContentStatus, to: ContentStatus): void {
  const allowed = CONTENT_STATUS_FLOW[from] ?? []
  if (!allowed.includes(to)) {
    throw createAppError(
      'CONTENT_INVALID_STATUS',
      `Illegal status transition: ${from} -> ${to}`,
      'main',
      { from, to, allowed }
    )
  }
}
