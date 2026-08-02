import type { BondAbiFunctionFragment, BondAbiParam } from './bonds.types';

// Consolidated bond contracts: addresses, ABIs, and related constants

// ============================================================================
// BUY BOND CONTRACTS
// ============================================================================

// Buy Bond V1 Address
export const BUY_BOND_ADDRESS_V1 = '0xA3adf8952982Eac60C0E43d6F93C66E7363c6Fe2';

// Buy Bond V2 Address
export const BUY_BOND_ADDRESS_V2 = '0x431030E3A0703f0914bE26026ffDaD693F3a16cf';

// Buy Bond committedPrana ABI (shared minimal ABI for V1 + V2)
// Keep this list minimal: only include functions the app actually calls.
export const BUY_BOND_COMMITTED_PRANA_ABI: BondAbiFunctionFragment[] = [
  {
    inputs: [],
    name: 'committedPrana',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// Default exports use V2 contracts
export const BUY_BOND_ADDRESS = BUY_BOND_ADDRESS_V2;

// ============================================================================
// SELL BOND CONTRACTS
// ============================================================================

// Sell Bond V1 Address
export const SELL_BOND_ADDRESS_V1 = '0x2A48215e134a9382e1eBAf96F2Fa47Ca1c2fa092';

// Sell Bond V2 Address
export const SELL_BOND_ADDRESS_V2 = '0xA6aa0662f5A37ec6E86b3390C46B6eba21a31f71';

// Sell Bond committedWbtc ABI (shared minimal ABI for V1 + V2)
// Keep this list minimal: only include functions the app actually calls.
export const SELL_BOND_COMMITTED_WBTC_ABI: BondAbiFunctionFragment[] = [
  {
    inputs: [],
    name: 'committedWbtc',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// Default exports use V2 contracts
export const SELL_BOND_ADDRESS = SELL_BOND_ADDRESS_V2;

/** Create-bond function names used by the app — V2 exact-WBTC only. */
export const BUY_BOND_V2_CREATE_FUNCTION_NAMES = [
  'buyBondForWbtcAmount',
] as const;

export const SELL_BOND_V2_CREATE_FUNCTION_NAMES = ['sellBond'] as const;

const PAUSED_FRAGMENT: BondAbiFunctionFragment = {
  inputs: [],
  name: 'paused',
  outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
  stateMutability: 'view',
  type: 'function',
};

const CLAIM_BOND_FRAGMENT: BondAbiFunctionFragment = {
  inputs: [{ internalType: 'uint256', name: 'bondId', type: 'uint256' }],
  name: 'claimBond',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function',
};

const BUY_BOND_STRUCT_COMPONENTS: BondAbiParam[] = [
  { internalType: 'uint256', name: 'id', type: 'uint256' },
  { internalType: 'address', name: 'owner', type: 'address' },
  { internalType: 'uint256', name: 'wbtcAmount', type: 'uint256' },
  { internalType: 'uint256', name: 'pranaAmount', type: 'uint256' },
  { internalType: 'uint256', name: 'maturityTime', type: 'uint256' },
  { internalType: 'uint256', name: 'creationTime', type: 'uint256' },
  { internalType: 'uint256', name: 'lastClaimTime', type: 'uint256' },
  { internalType: 'uint256', name: 'claimedPrana', type: 'uint256' },
  { internalType: 'bool', name: 'claimed', type: 'bool' },
];

const SELL_BOND_STRUCT_COMPONENTS: BondAbiParam[] = [
  { internalType: 'uint256', name: 'id', type: 'uint256' },
  { internalType: 'address', name: 'owner', type: 'address' },
  { internalType: 'uint256', name: 'pranaAmount', type: 'uint256' },
  { internalType: 'uint256', name: 'wbtcAmount', type: 'uint256' },
  { internalType: 'uint256', name: 'maturityTime', type: 'uint256' },
  { internalType: 'uint256', name: 'creationTime', type: 'uint256' },
  { internalType: 'uint256', name: 'lastClaimTime', type: 'uint256' },
  { internalType: 'uint256', name: 'claimedWbtc', type: 'uint256' },
  { internalType: 'bool', name: 'claimed', type: 'bool' },
];

const BUY_GET_USER_ACTIVE_BONDS_FRAGMENT: BondAbiFunctionFragment = {
  inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
  name: 'getUserActiveBonds',
  outputs: [
    {
      components: BUY_BOND_STRUCT_COMPONENTS,
      internalType: 'struct BuyPranaBondV2.Bond[]',
      name: '',
      type: 'tuple[]',
    },
  ],
  stateMutability: 'view',
  type: 'function',
};

const SELL_GET_USER_ACTIVE_BONDS_FRAGMENT: BondAbiFunctionFragment = {
  inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
  name: 'getUserActiveBonds',
  outputs: [
    {
      components: SELL_BOND_STRUCT_COMPONENTS,
      internalType: 'struct SellPranaBondV2.Bond[]',
      name: '',
      type: 'tuple[]',
    },
  ],
  stateMutability: 'view',
  type: 'function',
};

/**
 * Buy V1 + V2 account surface: paused, active-bond read, claim.
 * No create-bond functions — new bonds are V2-only.
 */
export const BUY_BOND_ACCOUNT_ABI: BondAbiFunctionFragment[] = [
  PAUSED_FRAGMENT,
  BUY_GET_USER_ACTIVE_BONDS_FRAGMENT,
  CLAIM_BOND_FRAGMENT,
];

/**
 * Sell V1 + V2 account surface: paused, active-bond read, claim.
 * No create-bond functions — new bonds are V2-only.
 */
export const SELL_BOND_ACCOUNT_ABI: BondAbiFunctionFragment[] = [
  PAUSED_FRAGMENT,
  SELL_GET_USER_ACTIVE_BONDS_FRAGMENT,
  CLAIM_BOND_FRAGMENT,
];

/**
 * Buy V2: account + config (min/terms) + impacted reserves + create writes.
 * Used with BUY_BOND_ADDRESS_V2 for readContract / writeContract.
 */
const IMPACTED_WBTC_RESERVE_FRAGMENT: BondAbiFunctionFragment = {
  inputs: [],
  name: 'impactedWbtcReserve',
  outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
};

const IMPACTED_PRANA_RESERVE_FRAGMENT: BondAbiFunctionFragment = {
  inputs: [],
  name: 'impactedPranaReserve',
  outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
};

export const BUY_BOND_V2_ABI: BondAbiFunctionFragment[] = [
  PAUSED_FRAGMENT,
  {
    inputs: [],
    name: 'minPranaBuyAmount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'enum BuyPranaBondV2.BondTerm',
        name: '',
        type: 'uint8',
      },
    ],
    name: 'bondRates',
    outputs: [
      { internalType: 'uint256', name: 'rate', type: 'uint256' },
      { internalType: 'uint256', name: 'duration', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  IMPACTED_WBTC_RESERVE_FRAGMENT,
  IMPACTED_PRANA_RESERVE_FRAGMENT,
  ...BUY_BOND_COMMITTED_PRANA_ABI,
  BUY_GET_USER_ACTIVE_BONDS_FRAGMENT,
  {
    inputs: [
      { internalType: 'uint256', name: 'wbtcAmount', type: 'uint256' },
      {
        internalType: 'enum BuyPranaBondV2.BondTerm',
        name: 'period',
        type: 'uint8',
      },
    ],
    name: 'buyBondForWbtcAmount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'pranaAmount', type: 'uint256' },
      {
        internalType: 'enum BuyPranaBondV2.BondTerm',
        name: 'period',
        type: 'uint8',
      },
    ],
    name: 'buyBondForPranaAmount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  CLAIM_BOND_FRAGMENT,
];

/**
 * Sell V2: account + config (min/terms) + create write.
 * Used with SELL_BOND_ADDRESS_V2 for readContract / writeContract.
 */
export const SELL_BOND_V2_ABI: BondAbiFunctionFragment[] = [
  PAUSED_FRAGMENT,
  {
    inputs: [],
    name: 'minPranaSellAmount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'enum SellPranaBondV2.BondTerm',
        name: '',
        type: 'uint8',
      },
    ],
    name: 'bondRates',
    outputs: [
      { internalType: 'uint256', name: 'rate', type: 'uint256' },
      { internalType: 'uint256', name: 'duration', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  IMPACTED_WBTC_RESERVE_FRAGMENT,
  IMPACTED_PRANA_RESERVE_FRAGMENT,
  ...SELL_BOND_COMMITTED_WBTC_ABI,
  SELL_GET_USER_ACTIVE_BONDS_FRAGMENT,
  {
    inputs: [
      { internalType: 'uint256', name: 'pranaAmount', type: 'uint256' },
      {
        internalType: 'enum SellPranaBondV2.BondTerm',
        name: 'period',
        type: 'uint8',
      },
    ],
    name: 'sellBond',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  CLAIM_BOND_FRAGMENT,
];

/** Function names present on a bond ABI fragment list (for tests / guards). */
export function bondAbiFunctionNames(
  abi: readonly BondAbiFunctionFragment[],
): string[] {
  return abi.map((fragment) => fragment.name);
}

// ============================================================================
// BOND VOLUME FRAGMENTS (for scanning bonds)
// ============================================================================

export const BUY_BOND_BONDS_ABI: BondAbiFunctionFragment[] = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'bonds',
    outputs: [
      {
        components: BUY_BOND_STRUCT_COMPONENTS,
        internalType: 'struct BuyPranaBondV2.Bond',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export const SELL_BOND_BONDS_ABI: BondAbiFunctionFragment[] = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'bonds',
    outputs: [
      {
        components: SELL_BOND_STRUCT_COMPONENTS,
        internalType: 'struct SellPranaBondV2.Bond',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
