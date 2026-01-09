// Shared minimal ABI for Sell Bond contracts (V1 + V2).
// Keep this list minimal: only include functions the app actually calls.
export const SELL_BOND_ABI = [
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
