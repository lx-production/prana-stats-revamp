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
 * Signed permit captured after Sign Permit succeeds.
 * Invalidated when amount/duration/account/chain changes or deadline expires.
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
