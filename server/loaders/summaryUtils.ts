import fs from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_ROOT } from '../projectRoot.ts';
import { readJsonIfExists } from '../../utils/jsonHelper.ts';
import type { PricePoint } from '../../types/pricePoint.ts';

export function toFiniteNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function mdList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function mdNumbered(items: Array<{ title: string; body: string }>): string {
  return items.map((item, index) => `${index + 1}. **${item.title}**\n   ${item.body}`).join('\n');
}

export function mdQuestions(items: Array<{ question: string; answer: string }>): string {
  return items.map((item, index) => `${index + 1}. **${item.question}**\n   ${item.answer}`).join('\n');
}

export async function readMarkdownData(filename: string): Promise<string> {
  return await fs.readFile(path.join(PROJECT_ROOT, 'data', filename), 'utf8');
}

export async function readPricePointSeries(filename: string): Promise<PricePoint[]> {
  const data = await readJsonIfExists<unknown>(path.join(PROJECT_ROOT, filename));
  return (Array.isArray(data) ? data : []) as PricePoint[];
}
