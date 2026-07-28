import { formatUnits, parseUnits } from 'viem';
import { SECONDS_PER_DAY } from '../../constants/network.ts';
import {
  PRANA_DECIMALS,
  WBTC_DECIMALS,
} from '../../constants/sharedContracts.ts';

import type {
  ActiveBondRecord,
  BondActionState,
  BondAmountParseResult,
  BondingTermOption,
  BondTermId,
} from './bonding.types.ts';

/** Preferred default term length when present in V2 config. */
export const DEFAULT_BOND_TERM_DAYS = 30;

/**
 * Parse a user amount string into raw units for the given token decimals.
 * Rejects empty/invalid/zero/negative and more than `decimals` fraction digits.
 * No scientific notation — amounts stay exact decimal strings into parseUnits.
 */
export function parseBondAmount(
  input: string,
  decimals: number,
): BondAmountParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  // Allow leading digits + optional decimal part only (no scientific notation).
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    if (/^-\d+(\.\d+)?$/.test(trimmed)) return { ok: false, reason: 'negative' };
    return { ok: false, reason: 'invalid' };
  }

  const decimalPart = trimmed.split('.')[1];
  if (decimalPart && decimalPart.length > decimals) {
    return { ok: false, reason: 'too_many_decimals' };
  }

  try {
    const raw = parseUnits(trimmed, decimals);
    if (raw === 0n) return { ok: false, reason: 'zero' };
    return { ok: true, raw };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** WBTC amount parser (8 decimals). */
export function parseWbtcAmount(input: string): BondAmountParseResult {
  return parseBondAmount(input, WBTC_DECIMALS);
}

/** PRANA amount parser (9 decimals). */
export function parsePranaAmount(input: string): BondAmountParseResult {
  return parseBondAmount(input, PRANA_DECIMALS);
}

/** True while the user is typing a plausible decimal (may still be incomplete). */
export function isBondAmountInput(value: string, decimals: number): boolean {
  if (value === '') return true;
  if (!/^\d*\.?\d*$/.test(value)) return false;
  const decimalPart = value.split('.')[1];
  return !decimalPart || decimalPart.length <= decimals;
}

/** Format raw token units for UI display. */
export function formatTokenAmount(
  raw: bigint | string,
  decimals: number,
): string {
  const value = typeof raw === 'bigint' ? raw : BigInt(raw || '0');
  return formatUnits(value, decimals);
}

export function formatWbtcAmount(raw: bigint | string): string {
  return formatTokenAmount(raw, WBTC_DECIMALS);
}

export function formatPranaAmount(raw: bigint | string): string {
  return formatTokenAmount(raw, PRANA_DECIMALS);
}

/**
 * Set amount input from a raw balance without Number/parseFloat.
 * Used by MAX for exact WBTC Buy and exact PRANA Sell.
 */
export function rawBalanceToAmountInput(
  raw: bigint | string,
  decimals: number,
): string {
  return formatUnits(typeof raw === 'bigint' ? raw : BigInt(raw || '0'), decimals);
}

/** Prefer 30-day term when present; otherwise the first config option. */
export function getDefaultTermId(
  terms: BondingTermOption[],
): BondTermId | null {
  if (terms.length === 0) return null;
  const thirtyDay = terms.find(
    (term) => term.durationSeconds === DEFAULT_BOND_TERM_DAYS * SECONDS_PER_DAY,
  );
  return (thirtyDay ?? terms[0]).termId;
}

/** Resolve a term against the latest on-chain config snapshot. */
export function getConfiguredTerm(
  terms: BondingTermOption[],
  termId: BondTermId | null,
): BondingTermOption | null {
  if (termId == null) return null;
  return terms.find((term) => term.termId === termId) ?? null;
}

export function daysFromSeconds(seconds: number): number {
  return Math.floor(seconds / SECONDS_PER_DAY);
}

/**
 * Display rate from basis-points string without float math on the raw amount.
 * 10_000 bps = 100%.
 */
export function formatRateBpsPercent(rateBpsRaw: string): string {
  const bps = BigInt(rateBpsRaw || '0');
  const whole = bps / 100n;
  const frac = bps % 100n;
  if (frac === 0n) return `${whole.toString()}%`;
  const fracStr = frac.toString().padStart(2, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fracStr}%`;
}

/**
 * Bonding vesting progress 0–100 from creation → maturity (integer floor).
 * Independent of lastClaimTime — matches contract cumulative vesting math.
 */
export function getBondProgressPercent(
  creationTime: number,
  maturityTime: number,
  nowSeconds: number,
): number {
  const total = maturityTime - creationTime;
  if (total <= 0) return 100;
  if (nowSeconds <= creationTime) return 0;
  if (nowSeconds >= maturityTime) return 100;
  return Math.min(
    100,
    Math.floor(((nowSeconds - creationTime) * 100) / total),
  );
}

/**
 * Cumulative vested payout minus already claimed (Solidity floor division).
 * Before maturity: floor(totalPayout × elapsed / duration) − claimed.
 * From maturity: totalPayout − claimed.
 */
export function getBondClaimableRaw(
  totalPayoutRaw: bigint,
  claimedRaw: bigint,
  creationTime: number,
  maturityTime: number,
  nowSeconds: number,
): bigint {
  if (totalPayoutRaw <= claimedRaw) return 0n;
  if (nowSeconds <= creationTime) return 0n;

  if (nowSeconds >= maturityTime) {
    return totalPayoutRaw - claimedRaw;
  }

  const total = BigInt(maturityTime - creationTime);
  if (total <= 0n) return totalPayoutRaw - claimedRaw;

  const elapsed = BigInt(nowSeconds - creationTime);
  const totalVested = (totalPayoutRaw * elapsed) / total;
  if (totalVested <= claimedRaw) return 0n;
  return totalVested - claimedRaw;
}

const SIDE_ORDER = { buy: 0, sell: 1 } as const;
const VERSION_ORDER = { v1: 0, v2: 1 } as const;

/** Sort by nearest maturity, then side / version / id. */
export function sortActiveBonds(
  bonds: ActiveBondRecord[],
): ActiveBondRecord[] {
  return [...bonds].sort((a, b) => {
    if (a.maturityTime !== b.maturityTime) {
      return a.maturityTime - b.maturityTime;
    }
    if (a.side !== b.side) {
      return SIDE_ORDER[a.side] - SIDE_ORDER[b.side];
    }
    if (a.version !== b.version) {
      return VERSION_ORDER[a.version] - VERSION_ORDER[b.version];
    }
    try {
      const diff = BigInt(a.id) - BigInt(b.id);
      if (diff < 0n) return -1;
      if (diff > 0n) return 1;
      return 0;
    } catch {
      return a.id.localeCompare(b.id);
    }
  });
}

/** Total payout raw for the bond's payout token (PRANA buy / WBTC sell). */
export function getBondTotalPayoutRaw(bond: ActiveBondRecord): bigint {
  return BigInt(bond.side === 'buy' ? bond.pranaAmountRaw : bond.wbtcAmountRaw);
}

/**
 * Claim eligibility from cumulative vesting.
 * lastClaimTime only gates same-second double claims — it does not change vested math.
 */
export function getBondActionState(
  bond: ActiveBondRecord,
  nowSeconds: number,
): BondActionState {
  const totalPayoutRaw = getBondTotalPayoutRaw(bond);
  const claimedRaw = BigInt(bond.claimedRaw);
  const claimableRaw = getBondClaimableRaw(
    totalPayoutRaw,
    claimedRaw,
    bond.creationTime,
    bond.maturityTime,
    nowSeconds,
  );
  const progressPercent = getBondProgressPercent(
    bond.creationTime,
    bond.maturityTime,
    nowSeconds,
  );

  // Contract: require(block.timestamp > lastClaimTime) and !claimed.
  const canClaim =
    !bond.claimed &&
    claimableRaw > 0n &&
    nowSeconds > bond.lastClaimTime;

  return { claimableRaw, progressPercent, canClaim };
}
