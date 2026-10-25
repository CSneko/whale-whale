/** Diagnostic rendering for settings failures; errors never become successful results. @module */

/**
 * Retain the reported reason and code while removing credentials from display text.
 * @param error - Remote failure or local call-assembly failure.
 * @param secrets - Unsaved password values in the affected editor.
 * @param fallback - Localized text for a failure without a diagnostic message.
 * @returns Bounded plain text for React to escape.
 */
export function operationFailure(error: unknown, secrets: readonly string[], fallback: string): string {
  let text = error instanceof Error && error.message ? error.message : fallback
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    text = `[${error.code}] ${text}`
  }
  for (const value of secrets) {
    if (value.trim()) text = text.replaceAll(value, '[redacted]').replaceAll(value.trim(), '[redacted]')
  }
  return text.replace(/Bearer\s+[^\s"']+/giu, 'Bearer [redacted]')
    .replace(/(https?:\/\/)[^\s/]*@/giu, '$1[redacted]@').slice(0, 2000)
}
