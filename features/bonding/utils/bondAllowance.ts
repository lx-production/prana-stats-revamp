import type { BondingQuoteMode } from '../bonding.types.ts';

/**
 * Exact WBTC Buy / Exact PRANA Sell: allowance >= fixed input is enough.
 * Never lower a larger allowance.
 */
export function needsExactInputApproval(
  currentAllowanceRaw: bigint,
  inputAmountRaw: bigint,
): boolean {
  return currentAllowanceRaw < inputAmountRaw;
}

/**
 * Target PRANA Buy spending-cap rules:
 * - If allowance < quote → must approve quote amount.
 * - If surplus allowance and no session cap covering quote → must approve
 *   exact quote (lower the cap), even when allowance is already larger.
 * - After a session cap was set and still covers the quote, allowance >= quote
 *   is enough (quote may drop without forcing another approve).
 */
export function needsTargetPranaApproval(input: {
  currentAllowanceRaw: bigint;
  quoteWbtcAmountRaw: bigint;
  /** Cap intentionally set this session via approve(quote); null if unset. */
  sessionApprovedCapRaw: bigint | null;
}): boolean {
  const { currentAllowanceRaw, quoteWbtcAmountRaw, sessionApprovedCapRaw } =
    input;

  if (quoteWbtcAmountRaw <= 0n) return false;

  if (currentAllowanceRaw < quoteWbtcAmountRaw) return true;

  if (
    sessionApprovedCapRaw != null &&
    sessionApprovedCapRaw >= quoteWbtcAmountRaw &&
    currentAllowanceRaw >= quoteWbtcAmountRaw
  ) {
    return false;
  }

  // Surplus without a covering session cap → force exact quote approve.
  if (currentAllowanceRaw > quoteWbtcAmountRaw) return true;

  return false;
}

/** Amount to pass to ERC-20 approve() for the current quote mode. */
export function resolveApproveAmountRaw(input: {
  mode: BondingQuoteMode;
  /** Fixed WBTC (exact buy) or PRANA (sell) input. */
  inputAmountRaw: bigint;
  /** Quoted WBTC for target PRANA buy. */
  quoteWbtcAmountRaw: bigint;
}): bigint {
  if (input.mode === 'buy_target_prana') {
    return input.quoteWbtcAmountRaw;
  }
  return input.inputAmountRaw;
}

/** Whether create/review can proceed under current allowance + mode. */
export function isAllowanceSufficientForCreate(input: {
  mode: BondingQuoteMode;
  currentAllowanceRaw: bigint;
  inputAmountRaw: bigint;
  quoteWbtcAmountRaw: bigint;
}): boolean {
  if (input.mode === 'buy_target_prana') {
    return input.currentAllowanceRaw >= input.quoteWbtcAmountRaw;
  }
  return !needsExactInputApproval(
    input.currentAllowanceRaw,
    input.inputAmountRaw,
  );
}
