import fs from 'node:fs/promises';

async function readJsonIfExists<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export { readJsonIfExists };
