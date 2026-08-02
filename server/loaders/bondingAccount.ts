import { erc20Abi } from 'viem';
import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { toBigInt } from '../../utils/fetchActiveStakesUtils.ts';
import { PRANA_ADDRESS, WBTC_ADDRESS } from '../../constants/sharedContracts.ts';
import { mapActiveBondRecords, mergeActiveBondRecords } from '../utils/bondingReadUtils.ts';
import { BUY_BOND_ADDRESS_V1, BUY_BOND_ADDRESS_V2, SELL_BOND_ADDRESS_V1, SELL_BOND_ADDRESS_V2, BUY_BOND_ACCOUNT_ABI, SELL_BOND_ACCOUNT_ABI } from '../../constants/bonds.ts';

import type { Address } from '../../types/blockchain.types.ts';
import type { BondingAccount } from '../../features/bonding/bonding.types.ts';

/**
 * Live wallet snapshot: balances, V2 allowances, and active bonds from all four deployments.
 * All reads share one blockTag. Any contract read failure hard-fails (route → 502).
 */
export async function loadBondingAccount(address: Address): Promise<BondingAccount> {
  const provider = await getServerPolygonProvider();
  const block = await provider.getBlock('latest');
  if (!block) {
    throw new Error('Failed to resolve latest block');
  }

  const blockTag = block.number;
  const prana = new ethers.Contract(PRANA_ADDRESS, erc20Abi, provider);
  const wbtc = new ethers.Contract(WBTC_ADDRESS, erc20Abi, provider);
  const buyV1 = new ethers.Contract(BUY_BOND_ADDRESS_V1, BUY_BOND_ACCOUNT_ABI, provider);
  const buyV2 = new ethers.Contract(BUY_BOND_ADDRESS_V2, BUY_BOND_ACCOUNT_ABI, provider);
  const sellV1 = new ethers.Contract(SELL_BOND_ADDRESS_V1, SELL_BOND_ACCOUNT_ABI, provider);
  const sellV2 = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_ACCOUNT_ABI, provider);

  const [
    pranaBalance,
    wbtcBalance,
    buyV2WbtcAllowance,
    sellV2PranaAllowance,
    buyV1Bonds,
    buyV2Bonds,
    sellV1Bonds,
    sellV2Bonds,
  ] = await Promise.all([
    prana.balanceOf(address, { blockTag }),
    wbtc.balanceOf(address, { blockTag }),
    wbtc.allowance(address, BUY_BOND_ADDRESS_V2, { blockTag }),
    prana.allowance(address, SELL_BOND_ADDRESS_V2, { blockTag }),
    buyV1.getUserActiveBonds(address, { blockTag }),
    buyV2.getUserActiveBonds(address, { blockTag }),
    sellV1.getUserActiveBonds(address, { blockTag }),
    sellV2.getUserActiveBonds(address, { blockTag }),
  ]);

  const bonds = mergeActiveBondRecords([
    mapActiveBondRecords(buyV1Bonds as unknown[], 'buy', 'v1'),
    mapActiveBondRecords(buyV2Bonds as unknown[], 'buy', 'v2'),
    mapActiveBondRecords(sellV1Bonds as unknown[], 'sell', 'v1'),
    mapActiveBondRecords(sellV2Bonds as unknown[], 'sell', 'v2'),
  ]);

  return {
    address,
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    pranaBalanceRaw: toBigInt(pranaBalance).toString(),
    wbtcBalanceRaw: toBigInt(wbtcBalance).toString(),
    buyV2WbtcAllowanceRaw: toBigInt(buyV2WbtcAllowance).toString(),
    sellV2PranaAllowanceRaw: toBigInt(sellV2PranaAllowance).toString(),
    bonds,
  };
}
