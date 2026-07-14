export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function getErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error.toLowerCase();
  if (typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    const nestedError = errObj?.error as Record<string, unknown> | undefined;
    const nestedMessage = nestedError?.message as string | undefined;
    const infoPayload = errObj?.info as Record<string, unknown> | undefined;
    const infoError = infoPayload?.error as Record<string, unknown> | undefined;
    const infoMessage = infoError?.message as string | undefined;
    const message =
      errObj?.shortMessage ||
      errObj?.message ||
      errObj?.reason ||
      nestedMessage ||
      infoMessage ||
      '';
    if (typeof message === 'string') return message.toLowerCase();
  }
  return String(error).toLowerCase();
}

export function isRateLimitError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('retry in')
  );
}

export function toBigInt(value: unknown): bigint {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string' && value.length > 0) return BigInt(value);
    if (value && typeof (value as { toString: () => string }).toString === 'function') {
      return BigInt((value as { toString: () => string }).toString());
    }
  } catch {
    // ignore parse failures and treat as 0
  }
  return 0n;
}

export function toNumberSafe(value: unknown): number {
  const b = toBigInt(value);
  if (b > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Number(b);
}

export function formatUnixSecondsToHuman(unixSeconds: bigint): { iso: string; local: string } {
  const ms = toNumberSafe(unixSeconds) * 1000;
  const d = new Date(ms);
  return {
    iso: d.toISOString(),
    local: d.toLocaleString(),
  };
}
