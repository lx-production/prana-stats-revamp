import type { BondingQuoteEchoCheck } from './bondQuoteEcho.types.ts';

/**
 * True when the quote response echoes mode, termId, and the exact input leg.
 * Buy: wbtcAmountRaw === formInputRaw. Sell: pranaAmountRaw === formInputRaw.
 */
export function isBondingQuoteEchoValid(
  check: BondingQuoteEchoCheck,
): boolean {
  const { quote, mode, termId, formInputRaw } = check;
  if (quote.mode !== mode) return false;
  if (quote.termId !== termId) return false;

  const echoedInputRaw =
    mode === 'buy_exact_wbtc' ? quote.wbtcAmountRaw : quote.pranaAmountRaw;

  // API amounts are decimal strings; match the locked form bigint.
  return echoedInputRaw === formInputRaw.toString();
}

/**
 * Calldata input for create — always the form snapshot.
 * Never take the input leg from the quote response (avoids race/regression).
 */
export function resolveCreateAmountRaw(formInputRaw: bigint): bigint {
  return formInputRaw;
}
