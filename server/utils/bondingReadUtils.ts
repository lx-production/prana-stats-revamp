import { parseUnsignedDecimalRaw } from './parseUnsignedDecimalRaw.ts';
import { toBigInt, toNumberSafe } from '../../utils/fetchActiveStakesUtils.ts';

import type { Address, Hex } from '../../types/blockchain.types.ts';
import type { ActiveBondRecord, BondSide, BondTermId, BondVersion, BondingQuoteMode, BondingQuoteRequest, BondingTermOption, BondingTransactionActionSnapshot, BondingTransactionConfirmationRequest } from '../../features/bonding/bonding.types.ts';

export {
  mulDiv,
  computePoolReserves,
  ensurePositiveReserve,
  computeBondingQuote,
} from './bondingQuoteMath.ts';

export type {
  BondingQuoteMathInput,
  BondingQuoteMathResult,
} from './bondingQuoteMath.ts';

export {
  MAX_UINT256,
  MAX_UINT256_DECIMAL_DIGITS,
  parseUnsignedDecimalRaw,
} from './parseUnsignedDecimalRaw.ts';

const BOND_TERM_IDS: readonly BondTermId[] = [0, 1, 2, 3, 4];
const QUOTE_MODES: readonly BondingQuoteMode[] = [
  'buy_exact_wbtc',
  'sell_exact_prana',
];

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

/**
 * Merge Buy/Sell × V1/V2 active-bond lists.
 * Duplicate numeric ids across deployments stay distinct via side + version.
 */
export function mergeActiveBondRecords(
  groups: readonly ActiveBondRecord[][],
): ActiveBondRecord[] {
  return groups.flat();
}

/** Input/shape errors for Bonding POST APIs — routes map these to HTTP 400. */
export class BondingApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BondingApiValidationError';
  }
}

/** Sender/target/calldata mismatch — never report as confirmed. */
export class BondingConfirmationMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BondingConfirmationMismatchError';
  }
}

/** uint256 decimal in range; used for approve (zero = revoke allowance is supported). */
function requireUint256Raw(value: unknown, message: string): bigint {
  const parsed = parseUnsignedDecimalRaw(value);
  if (parsed === null) {
    throw new BondingApiValidationError(message);
  }
  return parsed;
}

/** uint256 decimal that must be strictly greater than zero (quote/create/claim). */
function requirePositiveUint256Raw(value: unknown, message: string): bigint {
  const parsed = requireUint256Raw(value, message);
  if (parsed === 0n) {
    throw new BondingApiValidationError(message);
  }
  return parsed;
}

export function parseBondingQuoteRequest(body: unknown): BondingQuoteRequest {
  if (!body || typeof body !== 'object') {
    throw new BondingApiValidationError('Invalid bonding quote request.');
  }

  const payload = body as Record<string, unknown>;
  const mode = payload.mode;
  if (typeof mode !== 'string' || !QUOTE_MODES.includes(mode as BondingQuoteMode)) {
    throw new BondingApiValidationError('Invalid bonding quote mode.');
  }

  // Quote amount must be > 0 so we never burn RPC on a no-op uint256 zero.
  const amountRaw = requirePositiveUint256Raw(
    payload.amountRaw,
    'Invalid bonding quote amount.',
  );

  const termIdRaw = payload.termId;
  if (typeof termIdRaw !== 'number' || !isBondTermId(termIdRaw)) {
    throw new BondingApiValidationError('Invalid bonding quote term.');
  }

  return {
    mode: mode as BondingQuoteMode,
    amountRaw: amountRaw.toString(),
    termId: termIdRaw,
  };
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export function parseBondingConfirmationRequest(
  body: unknown,
  parseAddress: (value: unknown) => Address | null,
): BondingTransactionConfirmationRequest {
  if (!body || typeof body !== 'object') {
    throw new BondingApiValidationError('Invalid bonding confirmation request.');
  }

  const payload = body as Record<string, unknown>;
  if (
    typeof payload.transactionHash !== 'string' ||
    !TX_HASH_RE.test(payload.transactionHash)
  ) {
    throw new BondingApiValidationError('Invalid bonding transaction hash.');
  }

  const account = parseAddress(payload.account);
  if (!account) {
    throw new BondingApiValidationError('Invalid bonding confirmation account.');
  }

  const action = parseBondingActionSnapshot(payload.action);
  return {
    transactionHash: payload.transactionHash as Hex,
    account,
    action,
  };
}

function parseBondingActionSnapshot(value: unknown): BondingTransactionActionSnapshot {
  if (!value || typeof value !== 'object') {
    throw new BondingApiValidationError('Invalid bonding confirmation action.');
  }

  const action = value as Record<string, unknown>;
  const kind = action.kind;

  if (kind === 'approve') {
    if (action.side !== 'buy' && action.side !== 'sell') {
      throw new BondingApiValidationError('Invalid bonding approve side.');
    }
    // Approve zero is supported (ERC-20 revoke / clear allowance).
    const amountRaw = requireUint256Raw(
      action.amountRaw,
      'Invalid bonding approve amount.',
    );
    return { kind: 'approve', side: action.side, amountRaw: amountRaw.toString() };
  }

  if (kind === 'create') {
    if (action.side !== 'buy' && action.side !== 'sell') {
      throw new BondingApiValidationError('Invalid bonding create side.');
    }
    if (action.version !== 'v2') {
      throw new BondingApiValidationError('Invalid bonding create version.');
    }
    if (
      typeof action.mode !== 'string' ||
      !QUOTE_MODES.includes(action.mode as BondingQuoteMode)
    ) {
      throw new BondingApiValidationError('Invalid bonding create mode.');
    }
    // Create mode must match side: buy_* for buy, sell_* for sell.
    if (action.side === 'buy' && action.mode === 'sell_exact_prana') {
      throw new BondingApiValidationError('Invalid bonding create mode for side.');
    }
    if (action.side === 'sell' && action.mode !== 'sell_exact_prana') {
      throw new BondingApiValidationError('Invalid bonding create mode for side.');
    }
    const amountRaw = requirePositiveUint256Raw(
      action.amountRaw,
      'Invalid bonding create amount.',
    );
    if (typeof action.termId !== 'number' || !isBondTermId(action.termId)) {
      throw new BondingApiValidationError('Invalid bonding create term.');
    }
    return {
      kind: 'create',
      side: action.side,
      version: 'v2',
      mode: action.mode as BondingQuoteMode,
      amountRaw: amountRaw.toString(),
      termId: action.termId,
    };
  }

  if (kind === 'claim') {
    if (action.side !== 'buy' && action.side !== 'sell') {
      throw new BondingApiValidationError('Invalid bonding claim side.');
    }
    if (action.version !== 'v1' && action.version !== 'v2') {
      throw new BondingApiValidationError('Invalid bonding claim version.');
    }
    const bondId = requirePositiveUint256Raw(
      action.bondId,
      'Invalid bonding claim id.',
    );
    return {
      kind: 'claim',
      side: action.side,
      version: action.version,
      bondId: bondId.toString(),
    };
  }

  throw new BondingApiValidationError('Invalid bonding confirmation action kind.');
}
