/**
 * Redact URLs / Alchemy key segments before writing errors to server or CI logs.
 * Mirrors the swap log sanitizer so RPC credentials never appear in plaintext.
 */
export function redactSensitiveText(value: string, maxLength = 1000): string {
  return value
    .replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
    .replace(/(alchemyapi\.io\/v2\/|alchemy\.com\/v2\/)[A-Za-z0-9_-]+/gi, '$1[redacted]')
    .slice(0, maxLength);
}

/** Turn any thrown value into a single redacted string safe for console.error. */
export function formatErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    const parts = [error.message];
    if (error.stack) parts.push(error.stack);
    return redactSensitiveText(parts.join('\n'));
  }

  return redactSensitiveText(String(error));
}
