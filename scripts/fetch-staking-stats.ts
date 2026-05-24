import process from 'node:process';
import { loadStakingStats } from '../server/loaders/stakingStats.ts';
import { formatCurrency } from '../utils/formatters.ts';

// run with: npm run fetch:staking-stats

const APR = 0.15;

function formatOptionalNumber(value: number | null | undefined, fractionDigits = 6): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

function calculateAdditionalStakeCapacityPrana(
  interestBalancePrana: number | null | undefined,
  interestCommittedPrana: number | null | undefined,
): number | null {
  const balance = typeof interestBalancePrana === 'number' ? interestBalancePrana : null;
  const committed = typeof interestCommittedPrana === 'number' ? interestCommittedPrana : null;

  if (!balance || balance <= 0 || !committed || committed < 0) return null;

  const remainingInterestPrana = Math.max(0, balance - committed);
  if (!Number.isFinite(remainingInterestPrana) || remainingInterestPrana <= 0) return null;

  const capacity = remainingInterestPrana / APR;
  return Number.isFinite(capacity) && capacity > 0 ? capacity : null;
}

async function main(): Promise<void> {
  console.log('Refetching fresh staking stats through the backend loader...');
  console.log('This bypasses browser cache and the running server API memory cache.\n');

  const stats = await loadStakingStats();
  const capacityPrana = calculateAdditionalStakeCapacityPrana(
    stats.interestContractBalancePrana,
    stats.interestPrana,
  );

  console.log('UI card values');
  console.log(`Total Value Staked: ${formatCurrency(stats.stakedPrana, 'PRANA')} PRANA`);
  console.log(`  = ${formatCurrency(stats.stakedVnd, 'VND')} VND`);
  console.log(`Staking Interest Balance: ${formatCurrency(stats.interestContractBalancePrana, 'PRANA')} PRANA`);
  console.log(`  = ${formatCurrency(stats.interestContractBalanceVnd, 'VND')} VND`);
  console.log(`  Surplus Runway: ${formatOptionalNumber(stats.surplusRunwayRemainingDays, 0)} days`);
  console.log(`Staking Interest Committed: ${formatCurrency(stats.interestPrana, 'PRANA')} PRANA`);
  console.log(`  = ${formatCurrency(stats.interestVnd, 'VND')} VND`);
  console.log(`  Capacity: ${formatCurrency(capacityPrana, 'PRANA')} PRANA`);

  console.log('\nDetailed calculated values');
  console.log(`stakedPrana: ${formatOptionalNumber(stats.stakedPrana)}`);
  console.log(`stakedVnd: ${formatOptionalNumber(stats.stakedVnd, 0)}`);
  console.log(`interestContractBalancePrana: ${formatOptionalNumber(stats.interestContractBalancePrana)}`);
  console.log(`interestContractBalanceVnd: ${formatOptionalNumber(stats.interestContractBalanceVnd, 0)}`);
  console.log(`interestPrana: ${formatOptionalNumber(stats.interestPrana)}`);
  console.log(`interestVnd: ${formatOptionalNumber(stats.interestVnd, 0)}`);
  console.log(`claimableUnclaimedInterestPrana: ${formatOptionalNumber(stats.claimableUnclaimedInterestPrana)}`);
  console.log(`dailyInterestPrana: ${formatOptionalNumber(stats.dailyInterestPrana)}`);
  console.log(`surplusRunwayRemainingDays: ${formatOptionalNumber(stats.surplusRunwayRemainingDays)}`);
  console.log(`additionalStakeCapacityPrana: ${formatOptionalNumber(capacityPrana)}`);
}

main().catch((err) => {
  console.error('Failed to fetch fresh staking stats:', err);
  process.exitCode = 1;
});
