import { ethers, type Provider } from 'ethers';
import { redactUrl } from './bondsScanUtils.ts';
import { TOP_HOLDING_ADDRESSES, type TopHoldingAddress } from '../constants/topHoldingAddresses.ts';
import {
  MINIMAL_ERC20_ABI,
  MULTICALL3_ADDRESS,
  MULTICALL3_ABI,
  PRANA_ADDRESS,
  PRANA_DECIMALS,
} from '../constants/sharedContracts.ts';
import type { TopHoldingAddressesBuildOutput, TopHoldingAddressesBuildOutputParams } from '../types/types.ts';

type MulticallBalanceResult = {
  success?: boolean;
  returnData?: string;
};

export async function fetchBalancesViaMulticall(
  provider: Provider,
  holders: TopHoldingAddress[] = TOP_HOLDING_ADDRESSES,
): Promise<bigint[]> {
  const iface = new ethers.Interface(MINIMAL_ERC20_ABI);
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

  const calls = holders.map((holder) => ({
    target: PRANA_ADDRESS,
    allowFailure: true,
    callData: iface.encodeFunctionData('balanceOf', [holder.address]),
  }));

  const results = (await multicall.aggregate3.staticCall(calls)) as MulticallBalanceResult[];

  return results.map((result) => {
    if (!result?.success || typeof result.returnData !== 'string') return 0n;
    try {
      const [raw] = iface.decodeFunctionResult('balanceOf', result.returnData);
      return typeof raw === 'bigint' ? raw : BigInt(raw?.toString?.() ?? '0');
    } catch {
      return 0n;
    }
  });
}

// Không dùng multicall, dùng parallel balanceOf calls. Tạo N requests cùng lúc. Chậm hơn, tốn RPC hơn
export async function fetchBalancesViaFallback(
  provider: Provider,
  holders: TopHoldingAddress[] = TOP_HOLDING_ADDRESSES,
): Promise<bigint[]> {
  const token = new ethers.Contract(PRANA_ADDRESS, MINIMAL_ERC20_ABI, provider);
  const raw = await Promise.all(
    holders.map(async (holder) => {
      try {
        const value = await token.balanceOf(holder.address);
        return typeof value === 'bigint' ? value : BigInt(value?.toString?.() ?? '0');
      } catch {
        return 0n;
      }
    })
  );
  return raw;
}

export function buildOutput({
  balancesRaw,
  rpcUrl,
  holders = TOP_HOLDING_ADDRESSES,
}: TopHoldingAddressesBuildOutputParams): TopHoldingAddressesBuildOutput {
  const normalizedHolders = holders.map((holder, index) => {
    const balanceRaw = balancesRaw[index] ?? 0n;
    return {
      address: holder.address,
      label: holder.label,
      balanceRaw: balanceRaw.toString(),
      balance: ethers.formatUnits(balanceRaw, PRANA_DECIMALS),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    rpcUrl: redactUrl(rpcUrl),
    token: {
      address: PRANA_ADDRESS,
      symbol: 'PRANA',
      decimals: PRANA_DECIMALS,
    },
    holders: normalizedHolders,
  };
}
