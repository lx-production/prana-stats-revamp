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
export const BUY_BOND_COMMITTED_PRANA_ABI = [
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

export const BUY_BOND_COMMITTED_PRANA_ABI_V1 = BUY_BOND_COMMITTED_PRANA_ABI;
export const BUY_BOND_COMMITTED_PRANA_ABI_V2 = BUY_BOND_COMMITTED_PRANA_ABI;

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
export const SELL_BOND_COMMITTED_WBTC_ABI = [
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

export const SELL_BOND_COMMITTED_WBTC_ABI_V1 = SELL_BOND_COMMITTED_WBTC_ABI;
export const SELL_BOND_COMMITTED_WBTC_ABI_V2 = SELL_BOND_COMMITTED_WBTC_ABI;

// Default exports use V2 contracts
export const SELL_BOND_ADDRESS = SELL_BOND_ADDRESS_V2;

// ============================================================================
// BOND VOLUME FRAGMENTS (for scanning bonds)
// ============================================================================

export const BUY_BOND_BONDS_ABI = [
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
        components: [
          {
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'wbtcAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'pranaAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'maturityTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'creationTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'lastClaimTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'claimedPrana',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'claimed',
            type: 'bool',
          },
        ],
        internalType: 'struct BuyPranaBondV2.Bond',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export const SELL_BOND_BONDS_ABI = [
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
        components: [
          {
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'owner',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'pranaAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'wbtcAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'maturityTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'creationTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'lastClaimTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'claimedWbtc',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'claimed',
            type: 'bool',
          },
        ],
        internalType: 'struct SellPranaBondV2.Bond',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
