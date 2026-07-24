import type { HexAddress } from '../types/blockchain.types.ts';

export const WBTC_ADDRESS: HexAddress = '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6';
export const PRANA_ADDRESS: HexAddress = '0x928277e774F34272717EADFafC3fd802dAfBD0F5';

// Token Decimals
export const PRANA_DECIMALS = 9;
export const WBTC_DECIMALS = 8;
export const USDT_DECIMALS = 6;

export const WBTC_PRANA_V3_POOL: HexAddress = '0xf9A9Fce44AC9E68D7e0B87516fE21536446B1AED';
export const MULTICALL3_ADDRESS: HexAddress = '0xcA11bde05977b3631167028862bE2a173976CA11';

export const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) payable returns (tuple(bool success,bytes returnData)[] returnData)',
] as const;
