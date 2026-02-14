import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const DEFAULT_RPC_FALLBACK = 'https://polygon-rpc.com';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const cleaned = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const eq = cleaned.indexOf('=');
    if (eq === -1) continue;

    const key = cleaned.slice(0, eq).trim();
    let value = cleaned.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) env[key] = value;
  }
  return env;
}

export async function loadDotEnvIntoProcessEnv(projectRoot: string): Promise<void> {
  const candidates = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    '.env.production',
    '.env.production.local',
  ];

  for (const filename of candidates) {
    const fullPath = path.join(projectRoot, filename);
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const parsed = parseDotEnv(content);
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    } catch {
      // ignore missing files
    }
  }
}

export function getRpcUrl(): string {
  return (
    process.env.VITE_ALCHEMY_POLYGON_MAIN ||
    process.env.POLYGON_RPC_URL ||
    DEFAULT_RPC_FALLBACK
  );
}

export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts[parts.length - 1] = '<redacted>';
      u.pathname = '/' + parts.join('/');
    }
    return u.toString();
  } catch {
    return '<invalid url>';
  }
}

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
