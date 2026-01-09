import { SELL_BOND_ADDRESS as SELL_BOND_ADDRESS_V1 } from './sellBondContractV1';
import { SELL_BOND_ADDRESS as SELL_BOND_ADDRESS_V2 } from './sellBondContractV2';
import { SELL_BOND_ABI as SELL_BOND_ABI_COMMON } from './sellBondContractAbi';

// For compatibility with existing imports:
export const SELL_BOND_ABI_V1 = SELL_BOND_ABI_COMMON;
export const SELL_BOND_ABI_V2 = SELL_BOND_ABI_COMMON;
export { SELL_BOND_ADDRESS_V1, SELL_BOND_ADDRESS_V2 };

// set the default exports to use V2 contracts
export const SELL_BOND_ADDRESS = SELL_BOND_ADDRESS_V2;
export const SELL_BOND_ABI = SELL_BOND_ABI_COMMON;

