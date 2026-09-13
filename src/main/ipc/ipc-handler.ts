import { createAppError, type ErrorCode } from '@shared/errors'
import type { ValidationIssue } from '@shared/validators'
import { isSafeId, isReplizId } from '@shared/domain'

export function assertSafeId(id: string, channel: string): void {
  if (!isSafeId(id)) {
    throw createAppError('FS_PERMISSION_DENIED', `Invalid id: ${id}`, 'ipc', { channel, requested: id })
  }
}

export function assertReplizId(value: string): void {
  if (!isReplizId(value)) {
    throw createAppError('FS_VALIDATION_ERROR', 'replizId must be a 24-character hex ObjectId', 'ipc', { value })
  }
}

export function parseOptionalToken(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw createAppError('FS_VALIDATION_ERROR', 'Expected a string value', 'ipc', { value })
  }
  return value
}

export interface IpcValidation<T> {
  ok: true
  value: T
}

export interface IpcValidationFailure {
  ok: false
  issues: ValidationIssue[]
}

export function invalid(issues: ValidationIssue[]): IpcValidationFailure {
  return { ok: false, issues }
}

export function valid<T>(value: T): IpcValidation<T> {
  return { ok: true, value }
}

export interface CreateIpcHandlerOptions<TArgs extends unknown[], TData> {
  channel: string
  errorCode: ErrorCode
  validate?: (args: TArgs) => IpcValidation<TArgs> | IpcValidationFailure
  run: (args: TArgs) => Promise<TData>
}

export function validationIssuesError(channel: string, issues: ValidationIssue[]) {
  return createAppError('FS_VALIDATION_ERROR', `Invalid request for ${channel}`, 'ipc', { channel, issues })
}
