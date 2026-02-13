import { ethers } from 'ethers';
import { TOP_HOLDING_ADDRESSES } from '../constants/topHoldingAddresses.js';
import { PRANA_ADDRESS, PRANA_DECIMALS, PRANA_ABI, MULTICALL3_ADDRESS, MULTICALL3_ABI } from '../constants/sharedContracts.js';
import { redactUrl } from './bondsScanUtils.js';

async function fetchBalancesViaMulticall(provider) {
  const iface = new ethers.Interface(PRANA_ABI);
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

  const calls = TOP_HOLDING_ADDRESSES.map((holder) => ({
    target: PRANA_ADDRESS,
    allowFailure: true,
    callData: iface.encodeFunctionData('balanceOf', [holder.address]),
  }));

  const results = await multicall.aggregate3.staticCall(calls);
  
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

async function fetchBalancesViaFallback(provider) {
  const token = new ethers.Contract(PRANA_ADDRESS, PRANA_ABI, provider);
  const raw = await Promise.all(
    TOP_HOLDING_ADDRESSES.map(async (holder) => {
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

function buildOutput({ balancesRaw, rpcUrl }) {
  const holders = TOP_HOLDING_ADDRESSES.map((holder, index) => {
    const balanceRaw = balancesRaw[index] ?? 0n;
    return {
      address: holder.address,
      label: holder.label,
      balanceRaw: balanceRaw.toString(),
      balance: ethers.formatUnits(balanceRaw, PRANA_DECIMALS),
    };
  }).sort((a, b) => {
    const aa = BigInt(a.balanceRaw);
    const bb = BigInt(b.balanceRaw);
    if (aa === bb) return a.address.localeCompare(b.address);
    return aa > bb ? -1 : 1;
  });

  return {
    generatedAt: new Date().toISOString(),
    rpcUrl: redactUrl(rpcUrl),
    token: {
      address: PRANA_ADDRESS,
      symbol: 'PRANA',
      decimals: PRANA_DECIMALS,
    },
    holders,
  };
}

export { fetchBalancesViaMulticall, fetchBalancesViaFallback, buildOutput };
