import type {
  BondingQuoteIssue,
  BondingQuoteMode,
  BondingReserveSource,
  BondTermId,
} from '../../features/bonding/bonding.types.ts';

/** Floor(a × b ÷ denominator) with bigint — mirrors Solidity FullMath.mulDiv for in-range products. */
export function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error('FullMath: division by zero');
  }
  return (a * b) / denominator;
}

/** Uniswap V3 virtual reserves: token0=WBTC, token1=PRANA (matches UniswapV3Helper.sol). */
export function computePoolReserves(
  sqrtPriceX96: bigint,
  liquidity: bigint,
): { poolWbtc: bigint; poolPrana: bigint } {
  if (sqrtPriceX96 <= 0n || liquidity <= 0n) {
    return { poolWbtc: 0n, poolPrana: 0n };
  }

  const Q96 = 2n ** 96n;
  return {
    poolWbtc: mulDiv(liquidity, Q96, sqrtPriceX96),
    poolPrana: mulDiv(liquidity, sqrtPriceX96, Q96),
  };
}

/** Contract treats zero reserves as 1 to avoid div-by-zero in impact math. */
export function ensurePositiveReserve(value: bigint): bigint {
  return value <= 0n ? 1n : value;
}

export type BondingQuoteMathInput = {
  mode: BondingQuoteMode;
  amountRaw: bigint;
  termId: BondTermId;
  rateBps: bigint;
  durationSeconds: number;
  paused: boolean;
  minPranaRaw: bigint;
  impactedWbtc: bigint;
  impactedPrana: bigint;
  poolWbtc: bigint;
  poolPrana: bigint;
  /** Buy: available PRANA treasury; Sell: available WBTC treasury. */
  availableTreasuryRaw: bigint;
};

export type BondingQuoteMathResult = {
  wbtcAmountRaw: bigint;
  pranaAmountRaw: bigint;
  reserveSource: BondingReserveSource;
  issues: BondingQuoteIssue[];
};

/**
 * Pure quote math matching Buy/Sell V2 execution paths (1% fee, bps, floor div,
 * auto-sync to market when impacted is worse for the user).
 */
export function computeBondingQuote(input: BondingQuoteMathInput): BondingQuoteMathResult {
  const issues: BondingQuoteIssue[] = [];

  if (input.paused) {
    issues.push('paused');
  }

  if (!Number.isInteger(input.termId) || input.termId < 0 || input.termId > 4) {
    issues.push('invalid_term');
  }

  if (input.amountRaw <= 0n) {
    issues.push('zero_amount');
    return {
      wbtcAmountRaw: 0n,
      pranaAmountRaw: 0n,
      reserveSource: 'impacted',
      issues,
    };
  }

  if (input.mode === 'buy_exact_wbtc') {
    return quoteBuyExactWbtc(input, issues);
  }
  return quoteSellExactPrana(input, issues);
}

function quoteBuyExactWbtc(
  input: BondingQuoteMathInput,
  issues: BondingQuoteIssue[],
): BondingQuoteMathResult {
  const impactedWbtc = ensurePositiveReserve(input.impactedWbtc);
  const impactedPrana = ensurePositiveReserve(input.impactedPrana);
  const poolWbtc = ensurePositiveReserve(input.poolWbtc);
  const poolPrana = ensurePositiveReserve(input.poolPrana);

  const wbtcAfterFee = mulDiv(input.amountRaw, 99n, 100n);
  const impactedOut = mulDiv(
    impactedPrana,
    wbtcAfterFee,
    impactedWbtc + wbtcAfterFee,
  );
  const marketOut = mulDiv(poolPrana, wbtcAfterFee, poolWbtc + wbtcAfterFee);

  let baseline = impactedOut;
  let reserveSource: BondingReserveSource = 'impacted';

  if (baseline > marketOut) {
    baseline = marketOut;
    reserveSource = 'market';
  }

  if (baseline >= impactedPrana) {
    issues.push('exceeds_reserve');
  }

  const pranaOut = mulDiv(baseline, 10000n, 10000n - input.rateBps);

  if (pranaOut < input.minPranaRaw) {
    issues.push('below_minimum');
  }

  if (pranaOut > input.availableTreasuryRaw) {
    issues.push('insufficient_treasury');
  }

  return {
    wbtcAmountRaw: input.amountRaw,
    pranaAmountRaw: hasBlockingIssue(issues) ? 0n : pranaOut,
    reserveSource,
    issues,
  };
}

function quoteSellExactPrana(
  input: BondingQuoteMathInput,
  issues: BondingQuoteIssue[],
): BondingQuoteMathResult {
  const pranaIn = input.amountRaw;

  if (pranaIn < input.minPranaRaw) {
    issues.push('below_minimum');
  }

  const netPrana = mulDiv(pranaIn, 99n, 100n);
  if (netPrana <= 0n) {
    issues.push('zero_amount');
    return {
      wbtcAmountRaw: 0n,
      pranaAmountRaw: pranaIn,
      reserveSource: 'impacted',
      issues,
    };
  }

  const impactedWbtc = ensurePositiveReserve(input.impactedWbtc);
  const impactedPrana = ensurePositiveReserve(input.impactedPrana);
  const poolWbtc = ensurePositiveReserve(input.poolWbtc);
  const poolPrana = ensurePositiveReserve(input.poolPrana);

  const impactedOut = mulDiv(
    impactedWbtc,
    netPrana,
    impactedPrana + netPrana,
  );
  const marketOut = mulDiv(poolWbtc, netPrana, poolPrana + netPrana);

  let baseline = impactedOut;
  let reserveSource: BondingReserveSource = 'impacted';

  if (baseline > marketOut) {
    baseline = marketOut;
    reserveSource = 'market';
  }

  const wbtcOut = mulDiv(baseline, 10000n + input.rateBps, 10000n);

  if (wbtcOut > input.availableTreasuryRaw) {
    issues.push('insufficient_treasury');
  }

  return {
    wbtcAmountRaw: hasBlockingIssue(issues) ? 0n : wbtcOut,
    pranaAmountRaw: pranaIn,
    reserveSource,
    issues,
  };
}

/** Issues that mean the quote amounts must not be treated as executable. */
function hasBlockingIssue(issues: readonly BondingQuoteIssue[]): boolean {
  return issues.some(
    (issue) =>
      issue === 'exceeds_reserve' ||
      issue === 'insufficient_treasury' ||
      issue === 'zero_amount' ||
      issue === 'invalid_term',
  );
}
