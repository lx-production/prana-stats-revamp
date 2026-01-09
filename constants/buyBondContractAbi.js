// Shared minimal ABI for Buy Bond contracts (V1 + V2).
// Keep this list minimal: only include functions the app actually calls.
export const BUY_BOND_ABI = [
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

