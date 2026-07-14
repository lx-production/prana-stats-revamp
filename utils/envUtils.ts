import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs/promises';

export const DEFAULT_RPC_FALLBACK = 'https://polygon-rpc.com';

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
