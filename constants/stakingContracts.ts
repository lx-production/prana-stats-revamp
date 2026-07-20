import type { HexAddress } from '../types/blockchain.types.ts';

// Deployed staking + interest contracts on Polygon mainnet
export const STAKING_CONTRACT_ADDRESS: HexAddress = '0x714425A4F4d624ef83fEff810a0EEC30B0847868';
export const INTEREST_CONTRACT_ADDRESS: HexAddress = '0x1DE1E9BEF781fb3440C2c22E8ca1bF61BD26f69d';

/** EIP-712 permit domain for PRANA (must match on-chain token name/version). */
export const PRANA_PERMIT_DOMAIN_NAME = 'Prana_v2' as const;
export const PRANA_PERMIT_DOMAIN_VERSION = '1' as const;

/** How long a signed permit stays valid (1 hour). */
export const PERMIT_DEADLINE_SECONDS = 60 * 60;

/** EIP-2612 Permit typed-data field layout used when signing. */
export const PRANA_PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/**
 * Minimal typed staking ABI shared by stats loaders, staking API, and UI.
 * Includes only reads/writes the app uses — no admin setters or events.
 */
export const STAKING_CONTRACT_ABI = [
  // --- config / stats reads ---
  {
    type: 'function',
    name: 'paused',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'MIN_STAKE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'gracePeriod',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'earlyUnstakePenaltyPercent',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'totalInterestNeeded',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getAllAPRs',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'durations', type: 'uint256[]' },
      { name: 'aprs', type: 'uint8[]' },
    ],
  },
  {
    type: 'function',
    name: 'getStakers',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getStakerStakes',
    stateMutability: 'view',
    inputs: [{ name: 'staker', type: 'address' }],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint32' },
          { name: 'amount', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'duration', type: 'uint256' },
          { name: 'apr', type: 'uint8' },
          { name: 'lastClaimTime', type: 'uint256' },
        ],
      },
    ],
  },
  // --- user writes ---
  {
    type: 'function',
    name: 'stakeWithPermit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimInterest',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'stakeId', type: 'uint32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unstake',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'stakeId', type: 'uint32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unstakeEarly',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'stakeId', type: 'uint32' }],
    outputs: [],
  },
] as const;
