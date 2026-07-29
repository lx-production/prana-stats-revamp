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

/** Amount to pass to ERC-20 approve() — always the fixed input amount. */
export function resolveApproveAmountRaw(inputAmountRaw: bigint): bigint {
  return inputAmountRaw;
}

/** Whether create/review can proceed under current allowance. */
export function isAllowanceSufficientForCreate(
  currentAllowanceRaw: bigint,
  inputAmountRaw: bigint,
): boolean {
  return !needsExactInputApproval(currentAllowanceRaw, inputAmountRaw);
}
