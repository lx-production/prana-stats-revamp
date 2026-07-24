import { BUY_BOND_ADDRESS_V2 } from './bonds.ts';
import { WBTC_PRANA_V3_POOL } from './sharedContracts.ts';
import {
  DEX_POOL_BONDS_RESERVE_ADDRESS,
  PRANA_PROTOCOL_ADDRESS,
  PROTOCOL_RESERVE_ADDRESS,
} from './protocolAddresses.ts';
import {
  INTEREST_CONTRACT_ADDRESS,
  STAKING_CONTRACT_ADDRESS,
} from './stakingContracts.ts';

export interface TopHoldingAddress {
  address: string;
  label: string;
}

export const TOP_HOLDING_ADDRESSES: TopHoldingAddress[] = [
  { address: PRANA_PROTOCOL_ADDRESS, label: 'PRANA Protocol' },
  { address: PROTOCOL_RESERVE_ADDRESS, label: 'Protocol Reserve' },
  { address: STAKING_CONTRACT_ADDRESS, label: 'PRANA Staking' },
  { address: WBTC_PRANA_V3_POOL, label: 'WBTC/PRANA DEX Pool' },
  { address: DEX_POOL_BONDS_RESERVE_ADDRESS, label: 'DEX Pool & Bonds Reserve' },
  { address: BUY_BOND_ADDRESS_V2, label: 'BuyPranaBondV2 Contract' },
  { address: INTEREST_CONTRACT_ADDRESS, label: 'Staking Interest Contract' },
  { address: '0xD90F79E27867FCc2b923199f46226C67B0d0c2b1', label: 'Inactive holder' },
  { address: '0xF41c89a90f066Cd19C8Ed468A7C76F648dC84019', label: 'Inactive holder' },
  { address: '0x449dD115932DA6c857680ACcd49A7D5C5F9A8b8a', label: 'Last active Sep 17, 2025' },
];
