import { ethers } from 'ethers';
import { erc20Abi } from 'viem';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { toBigInt, toNumberSafe } from '../../utils/fetchActiveStakesUtils.ts';
import {
  BondingApiValidationError,
  computeBondingQuote,
  computePoolReserves,
  parseUnsignedDecimalRaw,
} from '../utils/bondingReadUtils.ts';
import {
  BUY_BOND_V2_ABI,
  SELL_BOND_V2_ABI,
  BUY_BOND_ADDRESS_V2,
  SELL_BOND_ADDRESS_V2,
} from '../../constants/bonds.ts';
import {
  PRANA_ADDRESS,
  WBTC_ADDRESS,
  UNISWAP_V3_POOL_ABI,
  WBTC_PRANA_V3_POOL,
} from '../../constants/sharedContracts.ts';

import type {
  BondingQuote,
  BondingQuoteRequest,
} from '../../features/bonding/bonding.types.ts';

/**
 * Live quote at one blockTag. Non-executable states still return 200-shaped quotes
 * with issues; RPC failures throw for the route to map to 502.
 */
export async function loadBondingQuote(
  request: BondingQuoteRequest,
): Promise<BondingQuote> {
  // Defensive re-parse: route already validated, but keep 400 (not 502) on bad amount.
  const amountRaw = parseUnsignedDecimalRaw(request.amountRaw);
  if (amountRaw === null || amountRaw === 0n) {
    throw new BondingApiValidationError('Invalid bonding quote amount.');
  }

  const provider = await getServerPolygonProvider();
  const block = await provider.getBlock('latest');
  if (!block) {
    throw new Error('Failed to resolve latest block');
  }

  const blockTag = block.number;
  const isBuy =
    request.mode === 'buy_exact_wbtc';

  const buyV2 = new ethers.Contract(BUY_BOND_ADDRESS_V2, BUY_BOND_V2_ABI, provider);
  const sellV2 = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_V2_ABI, provider);
  const pool = new ethers.Contract(WBTC_PRANA_V3_POOL, UNISWAP_V3_POOL_ABI, provider);
  const prana = new ethers.Contract(PRANA_ADDRESS, erc20Abi, provider);
  const wbtc = new ethers.Contract(WBTC_ADDRESS, erc20Abi, provider);

  const bondContract = isBuy ? buyV2 : sellV2;

  const [
    paused,
    minRaw,
    rateRow,
    impactedWbtc,
    impactedPrana,
    committed,
    treasuryBalance,
    slot0,
    liquidity,
  ] = await Promise.all([
    bondContract.paused({ blockTag }),
    isBuy
      ? buyV2.minPranaBuyAmount({ blockTag })
      : sellV2.minPranaSellAmount({ blockTag }),
    bondContract.bondRates(request.termId, { blockTag }),
    bondContract.impactedWbtcReserve({ blockTag }),
    bondContract.impactedPranaReserve({ blockTag }),
    isBuy
      ? buyV2.committedPrana({ blockTag })
      : sellV2.committedWbtc({ blockTag }),
    isBuy
      ? prana.balanceOf(BUY_BOND_ADDRESS_V2, { blockTag })
      : wbtc.balanceOf(SELL_BOND_ADDRESS_V2, { blockTag }),
    pool.slot0({ blockTag }),
    pool.liquidity({ blockTag }),
  ]);

  const rate = Array.isArray(rateRow)
    ? rateRow[0]
    : (rateRow as { rate?: unknown }).rate;
  const duration = Array.isArray(rateRow)
    ? rateRow[1]
    : (rateRow as { duration?: unknown }).duration;

  const sqrtPriceX96 = Array.isArray(slot0)
    ? toBigInt(slot0[0])
    : toBigInt((slot0 as { sqrtPriceX96?: unknown }).sqrtPriceX96);
  const { poolWbtc, poolPrana } = computePoolReserves(
    sqrtPriceX96,
    toBigInt(liquidity),
  );

  const committedRaw = toBigInt(committed);
  const balanceRaw = toBigInt(treasuryBalance);
  const availableTreasuryRaw =
    balanceRaw > committedRaw ? balanceRaw - committedRaw : 0n;

  const quoted = computeBondingQuote({
    mode: request.mode,
    amountRaw,
    termId: request.termId,
    rateBps: toBigInt(rate),
    durationSeconds: toNumberSafe(duration),
    paused: Boolean(paused),
    minPranaRaw: toBigInt(minRaw),
    impactedWbtc: toBigInt(impactedWbtc),
    impactedPrana: toBigInt(impactedPrana),
    poolWbtc,
    poolPrana,
    availableTreasuryRaw,
  });

  return {
    mode: request.mode,
    termId: request.termId,
    wbtcAmountRaw: quoted.wbtcAmountRaw.toString(),
    pranaAmountRaw: quoted.pranaAmountRaw.toString(),
    rateBpsRaw: toBigInt(rate).toString(),
    durationSeconds: toNumberSafe(duration),
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    reserveSource: quoted.reserveSource,
    issues: quoted.issues,
  };
}
