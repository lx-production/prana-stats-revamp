import { toBigInt, toNumberSafe } from '../../utils/fetchActiveStakesUtils.ts';

import type { Address } from '../../types/blockchain.types.ts';
import type {
  ActiveBondRecord,
  BondSide,
  BondVersion,
  BondingTermOption,
  BondTermId,
} from '../../features/bonding/bonding.types.ts';

const BOND_TERM_IDS: readonly BondTermId[] = [0, 1, 2, 3, 4];

/** True when value is a BondTerm id in 0..4. */
export function isBondTermId(value: number): value is BondTermId {
  return BOND_TERM_IDS.includes(value as BondTermId);
}

/**
 * Map a single bondRates(termId) result into a JSON-safe term option.
 * Rate stays a decimal string so large uint256 values are not coerced to number.
 */
export function mapBondTermOption(
  termId: BondTermId,
  rate: unknown,
  duration: unknown,
): BondingTermOption {
  return {
    termId,
    rateBpsRaw: toBigInt(rate).toString(),
    durationSeconds: toNumberSafe(duration),
  };
}

/**
 * Normalize getUserActiveBonds tuples into JSON-safe active bond records.
 * Bond id and token amounts are always decimal strings (never Number).
 */
export function mapActiveBondRecords(
  rawBonds: readonly unknown[],
  side: BondSide,
  version: BondVersion,
): ActiveBondRecord[] {
  return rawBonds.map((raw) => {
    const bond = raw as {
      id?: unknown;
      owner?: unknown;
      wbtcAmount?: unknown;
      pranaAmount?: unknown;
      maturityTime?: unknown;
      creationTime?: unknown;
      lastClaimTime?: unknown;
      claimedPrana?: unknown;
      claimedWbtc?: unknown;
      claimed?: unknown;
    };

    const claimedRaw =
      side === 'buy'
        ? toBigInt(bond.claimedPrana).toString()
        : toBigInt(bond.claimedWbtc).toString();

    return {
      id: toBigInt(bond.id).toString(),
      side,
      version,
      owner: String(bond.owner ?? '') as Address,
      wbtcAmountRaw: toBigInt(bond.wbtcAmount).toString(),
      pranaAmountRaw: toBigInt(bond.pranaAmount).toString(),
      maturityTime: toNumberSafe(bond.maturityTime),
      creationTime: toNumberSafe(bond.creationTime),
      lastClaimTime: toNumberSafe(bond.lastClaimTime),
      claimedRaw,
      claimed: Boolean(bond.claimed),
    };
  });
}
