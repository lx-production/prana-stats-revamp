import type { BondingQuote, BondingQuoteMode, BondTermId } from '../bonding.types.ts';

/** Inputs for checking that a quote response echoes the reviewed request. */
export type BondingQuoteEchoCheck = {
  quote: BondingQuote;
  mode: BondingQuoteMode;
  termId: BondTermId;
  /** Exact input raw locked in the form/review snapshot. */
  reviewedInputRaw: bigint;
};
