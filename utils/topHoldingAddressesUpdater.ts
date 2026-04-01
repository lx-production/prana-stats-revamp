import { ethers, type Provider } from 'ethers';
import { redactUrl } from './bondsScanUtils.ts';
import { getTopHoldingAddressesPageStartIndex } from './topHoldingAddressesPagination.ts';
import { TOP_HOLDING_ADDRESSES, type TopHoldingAddress } from '../constants/topHoldingAddresses.ts';
import { PRANA_ADDRESS, PRANA_DECIMALS, PRANA_ABI, MULTICALL3_ADDRESS, MULTICALL3_ABI } from '../constants/sharedContracts.ts';
import type { TopHoldingAddressBalance, TopHoldingAddressesBuildOutput, TopHoldingAddressesBuildOutputParams } from '../types.ts';

type MulticallBalanceResult = {
  success?: boolean;
  returnData?: string;
};

export async function fetchBalancesViaMulticall(
  provider: Provider,
  holders: TopHoldingAddress[] = TOP_HOLDING_ADDRESSES,
): Promise<bigint[]> {
  const iface = new ethers.Interface(PRANA_ABI);
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
  const token = new ethers.Contract(PRANA_ADDRESS, PRANA_ABI, provider);
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

export function mergeTopHoldingAddressesPage(params: {
  page: number;
  pageHolders: TopHoldingAddressBalance[];
  previousHolders?: TopHoldingAddressBalance[];
}) {
  const { page, pageHolders, previousHolders = [] } = params;
  const previousPageAddresses = new Set(
    TOP_HOLDING_ADDRESSES.slice(0, getTopHoldingAddressesPageStartIndex(page)).map((holder) => holder.address.toLowerCase())
  );
  const holdersByAddress = new Map<string, TopHoldingAddressBalance>();

  previousHolders.forEach((holder) => {
    const key = holder.address.toLowerCase();
    if (previousPageAddresses.has(key)) {
      holdersByAddress.set(key, holder);
    }
  });

  pageHolders.forEach((holder) => {
    holdersByAddress.set(holder.address.toLowerCase(), holder);
  });

  return TOP_HOLDING_ADDRESSES
    .map((holder) => holdersByAddress.get(holder.address.toLowerCase()))
    .filter((holder): holder is TopHoldingAddressBalance => Boolean(holder));
}
