import path from 'node:path';
import process from 'node:process';
import { loadActiveStakesSnapshot } from '../server/loaders/activeStakes.ts';
import { PROJECT_ROOT } from '../server/projectRoot.ts';

async function main(): Promise<void> {
  const outPath = path.join(PROJECT_ROOT, 'active_stakes.json');
  const out = await loadActiveStakesSnapshot();

  console.log(`Wrote ${out.activeStakes.length} active stakes to: ${outPath}`);
}

main().catch((err) => {
  console.error('Failed to fetch active stakes:', err);
  process.exitCode = 1;
});
