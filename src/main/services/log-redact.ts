/** Channels whose arguments carry secrets and must never be logged verbatim. */
const SENSITIVE_CHANNELS = new Set(['repliz:save-credentials'])

/** Redact handler args for the Tier-3 log; secrets are never persisted as plaintext. */
export function sanitizeForLog(channel: string, args: unknown[]): unknown {
  if (SENSITIVE_CHANNELS.has(channel)) {
    return { redacted: true, argCount: args.length }
  }
  return args.slice(0, 3)
}