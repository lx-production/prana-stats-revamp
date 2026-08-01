import type { BondingQuote, BondingQuoteMode, BondTermId } from '../bonding.types.ts';

/** Inputs for checking that a quote response echoes the form request. */
export type BondingQuoteEchoCheck = {
  quote: BondingQuote;
  mode: BondingQuoteMode;
  termId: BondTermId;
  /** Exact input raw locked in the form snapshot. */
  formInputRaw: bigint;
};
