import {
  PRANA_PERMIT_DOMAIN_NAME,
  PRANA_PERMIT_DOMAIN_VERSION,
} from '../../constants/stakingContracts.ts';

import type { Address, Hex } from '../../types/blockchain.types.ts';

/** One duration/APR pair from on-chain getAllAPRs (never hardcoded in the client). */
export type StakingDurationOption = {
  seconds: number;
  days: number;
  apr: number;
};

/** EIP-712 domain fields — literals come from stakingContracts constants. */
export type StakingPermitDomain = {
  name: typeof PRANA_PERMIT_DOMAIN_NAME;
  version: typeof PRANA_PERMIT_DOMAIN_VERSION;
};

export type StakingContractsSnapshot = {
  prana: Address;
  staking: Address;
  interest: Address;
};

/** Protocol config snapshot from GET /api/staking/config. */
export type StakingConfig = {
  chainId: number;
  blockNumber: number;
  blockTimestamp: number;
  paused: boolean;
  /** Min stake in token raw units (decimal string, not number). */
  minStakeRaw: string;
  gracePeriodSeconds: number;
  earlyUnstakePenaltyPercent: number;
  durations: StakingDurationOption[];
  contracts: StakingContractsSnapshot;
  permitDomain: StakingPermitDomain;
};

/** Single user stake as returned by the account API / on-chain getStakerStakes. */
export type StakeRecord = {
  id: number;
  amountRaw: string;
  startTime: number;
  durationSeconds: number;
  apr: number;
  lastClaimTime: number;
};

/** Wallet-specific snapshot from GET /api/staking/account. */
export type StakingAccountSnapshot = {
  address: Address;
  blockNumber: number;
  blockTimestamp: number;
  balanceRaw: string;
  permitNonce: string;
  stakes: StakeRecord[];
};

/**
 * Signed permit captured after createPermitSnapshot succeeds.
 * Invalidated when amount/duration/account/chain changes or deadline expires.
 * Kept across a rejected stake tx so Permit & Stake can skip re-signing.
 */
export type PermitSnapshot = {
  owner: Address;
  chainId: number;
  nonce: string;
  amountRaw: string;
  durationSeconds: number;
  deadline: number;
  v: number;
  r: Hex;
  s: Hex;
};

/**
 * Stake / claim / unstake transaction lifecycle shown in the UI.
 * Success only after waitForTransactionReceipt confirms (not on submit).
 */
export type StakeTransactionStatus =
  | 'idle'
  | 'signing'
  | 'signed'
  | 'submitting'
  | 'confirming'
  | 'success'
  | 'error';

/** Why `parseStakeAmount` rejected an input string. */
export type StakeAmountParseReason =
  | 'empty'
  | 'invalid'
  | 'zero'
  | 'negative'
  | 'too_many_decimals';

export type StakeAmountParseResult =
  | { ok: true; raw: bigint }
  | { ok: false; reason: StakeAmountParseReason };

/** Display / action status for a stake card (includes grace-period rules). */
export type StakeDisplayStatus =
  | 'active'
  | 'matured'
  | 'claim_first'
  | 'grace_expired';

/** Which stake-management write is in flight (locks other actions). */
export type StakeActionKind = 'claim' | 'unstake' | 'unstakeEarly';

/** Body for POST /api/staking/quote (fully-funded preflight). */
export type StakingQuoteRequest = {
  amountRaw: string;
  durationSeconds: number;
};

/**
 * Soft blockers for a stake quote — HTTP still 200 so the form can explain why.
 * Hard input/RPC failures stay 400/502 at the route layer.
 */
export type StakingQuoteIssue =
  | 'paused'
  | 'below_minimum'
  | 'invalid_duration'
  | 'zero_amount'
  | 'insufficient_interest_fund';

/**
 * Live interest-fund quote at one blockTag.
 * All amounts are decimal strings (bigint-safe); never float.
 */
export type StakingQuote = {
  amountRaw: string;
  durationSeconds: number;
  /** APR for the requested duration at this block (0 when invalid_duration). */
  apr: number;
  /** Solidity-order interest for this new stake. */
  newStakeInterestRaw: string;
  interestBalanceRaw: string;
  totalInterestNeededRaw: string;
  /** max(interestBalance − totalInterestNeeded, 0). */
  availableInterestFundRaw: string;
  minStakeRaw: string;
  paused: boolean;
  blockNumber: number;
  blockTimestamp: number;
  issues: StakingQuoteIssue[];
};
