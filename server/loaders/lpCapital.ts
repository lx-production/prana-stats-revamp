import { ethers } from 'ethers';
import type { LpCapitalApiResponse } from '../../types/api.types.ts';
import { fetchJsonSafe } from '../../utils/fetchJson.ts';
import { calculatePositionMath } from '../../utils/uniswapV3Helpers.ts';
import { MULTICALL3_ABI, MULTICALL3_ADDRESS } from '../../constants/sharedContracts.ts';
import { getServerArbitrumProvider } from '../utils/providers.ts';
import {
  NONFUNGIBLE_POSITION_MANAGER,
  WBTC_USDT_POOL,
  TARGET_OWNER,
  POOL_FEE,
  LP_TOKEN_ID_CACHE_TTL_MS,
  ARBITRUM_USDT,
  ARBITRUM_WBTC,
  ERC721_ENUMERABLE_ABI,
  POSITION_MANAGER_ABI,
  POOL_ABI,
} from '../../constants/arbitrumWbtcUsdtLp.ts';

interface GeckoPoolResponse {
  data?: {
    attributes?: {
      reserve_in_usd?: string;
      volume_usd?: {
        h24?: string;
      };
    };
  };
}

type CachedLpTokenId = {
  tokenId: number;
  expiresAt: number;
};

type MulticallResult = {
  success?: boolean;
  returnData?: string;
};

let cachedLpTokenId: CachedLpTokenId | null = null;

const POOL_IFACE = new ethers.Interface(POOL_ABI);
const POSITION_MANAGER_IFACE = new ethers.Interface([...ERC721_ENUMERABLE_ABI, ...POSITION_MANAGER_ABI]);
const EXPECTED_POOL_FEE_RAW = BigInt(Math.round(POOL_FEE * 1_000_000));

const EXPECTED_POOL_TOKEN0 = [ARBITRUM_USDT, ARBITRUM_WBTC]
  .map((address) => address.toLowerCase())
  .sort()[0]; // ensuring EXPECTED_POOL_TOKEN0 is always the lexicographically smaller address—matching how Uniswap V3 assigns token0 in a pool

const EXPECTED_POOL_TOKEN1 = [ARBITRUM_USDT, ARBITRUM_WBTC]
  .map((address) => address.toLowerCase())
  .sort()[1];

const TOKEN0_IS_WBTC = EXPECTED_POOL_TOKEN0 === ARBITRUM_WBTC.toLowerCase();

function getCachedLpTokenId(): CachedLpTokenId | null {
  const now = Date.now();
  return cachedLpTokenId && cachedLpTokenId.expiresAt > now ? cachedLpTokenId : null;
}

function setCachedLpTokenId(value: CachedLpTokenId | null) {
  cachedLpTokenId = value;
}

async function runMulticall(
  provider: ethers.JsonRpcProvider,
  calls: Array<{ target: string; allowFailure: boolean; callData: string }>
): Promise<MulticallResult[]> {
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  return (await multicall.aggregate3.staticCall(calls)) as MulticallResult[];
}

function decodeRequiredResult<T>(iface: ethers.Interface, method: string, result: MulticallResult): T {
  if (!result?.success || typeof result.returnData !== 'string') {
    throw new Error(`Multicall failed for ${method}`);
  }

  const decoded = iface.decodeFunctionResult(method, result.returnData);
  return (decoded.length === 1 ? decoded[0] : decoded) as T;
}

export async function loadLpCapital(): Promise<LpCapitalApiResponse> {
  const provider = await getServerArbitrumProvider();
  const geckoPoolPromise = fetchJsonSafe<GeckoPoolResponse>(
    `https://api.geckoterminal.com/api/v2/networks/arbitrum/pools/${WBTC_USDT_POOL.toLowerCase()}`,
    {}
  );
  const now = Date.now();
  const cachedToken = getCachedLpTokenId();
  const hasValidCache = cachedToken !== null && cachedToken.expiresAt > now;

  const initialCalls = [
    {
      target: WBTC_USDT_POOL,
      allowFailure: false,
      callData: POOL_IFACE.encodeFunctionData('slot0', []),
    },
    {
      target: WBTC_USDT_POOL,
      allowFailure: false,
      callData: POOL_IFACE.encodeFunctionData('feeGrowthGlobal0X128', []),
    },
    {
      target: WBTC_USDT_POOL,
      allowFailure: false,
      callData: POOL_IFACE.encodeFunctionData('feeGrowthGlobal1X128', []),
    },
    hasValidCache
      ? {
          target: NONFUNGIBLE_POSITION_MANAGER,
          allowFailure: true,
          callData: POSITION_MANAGER_IFACE.encodeFunctionData('positions', [cachedToken.tokenId]),
        }
      : {
          target: NONFUNGIBLE_POSITION_MANAGER,
          allowFailure: false,
          callData: POSITION_MANAGER_IFACE.encodeFunctionData('balanceOf', [TARGET_OWNER]),
        },
  ];

  const [slot0Result, feeGrowth0Result, feeGrowth1Result, fourthResult] = await runMulticall(provider, initialCalls);
  const slot0 = decodeRequiredResult<any>(POOL_IFACE, 'slot0', slot0Result);
  const feeGrowthGlobal0 = decodeRequiredResult<bigint>(POOL_IFACE, 'feeGrowthGlobal0X128', feeGrowth0Result);
  const feeGrowthGlobal1 = decodeRequiredResult<bigint>(POOL_IFACE, 'feeGrowthGlobal1X128', feeGrowth1Result);

  const geckoPool = await geckoPoolPromise;
  const currentTick = Number(slot0.tick);
  const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);

  const lowerTickCache = new Map<number, { feeGrowthOutside0X128: bigint; feeGrowthOutside1X128: bigint }>();
  const upperTickCache = new Map<number, { feeGrowthOutside0X128: bigint; feeGrowthOutside1X128: bigint }>();

  let totalUsd = 0;
  const matchedPositionIds: number[] = [];
  let activeCount = 0;
  const volume24hUsd = Number(geckoPool?.data?.attributes?.volume_usd?.h24 || 0);
  const tvlUsd = Number(geckoPool?.data?.attributes?.reserve_in_usd || 0);

  const apr24hPercentRaw =
    Number.isFinite(volume24hUsd) && Number.isFinite(tvlUsd) && tvlUsd > 0
      ? (volume24hUsd * POOL_FEE / tvlUsd) * 365 * 100
      : null;
  const apr24hPercent = apr24hPercentRaw !== null && Number.isFinite(apr24hPercentRaw) ? apr24hPercentRaw : null;

  const isPositionActiveForTargetPool = (position: any) =>
    String(position.token0).toLowerCase() === EXPECTED_POOL_TOKEN0 &&
    String(position.token1).toLowerCase() === EXPECTED_POOL_TOKEN1 &&
    BigInt(position.fee) === EXPECTED_POOL_FEE_RAW &&
    BigInt(position.liquidity) > 0n;

  let selectedTokenId: number | null = null;
  let selectedPosition: any | null = null;

  if (hasValidCache) {
    try {
      const cachedPosition = decodeRequiredResult<any>(POSITION_MANAGER_IFACE, 'positions', fourthResult);
      if (isPositionActiveForTargetPool(cachedPosition)) {
        selectedTokenId = cachedToken.tokenId;
        selectedPosition = cachedPosition;
      } else {
        setCachedLpTokenId(null);
      }
    } catch {
      setCachedLpTokenId(null);
    }
  }

  if (!hasValidCache || !selectedPosition) {
    const ownerBalanceRaw = hasValidCache
      ? decodeRequiredResult<bigint>(
          POSITION_MANAGER_IFACE,
          'balanceOf',
          (
            await runMulticall(provider, [
              {
                target: NONFUNGIBLE_POSITION_MANAGER,
                allowFailure: false,
                callData: POSITION_MANAGER_IFACE.encodeFunctionData('balanceOf', [TARGET_OWNER]),
              },
            ])
          )[0]
        )
      : decodeRequiredResult<bigint>(POSITION_MANAGER_IFACE, 'balanceOf', fourthResult);
    const ownerBalance = Number(ownerBalanceRaw);

    for (let ownerIndex = ownerBalance - 1; ownerIndex >= 0; ownerIndex -= 1) {
      const [tokenIdResult] = await runMulticall(provider, [
        {
          target: NONFUNGIBLE_POSITION_MANAGER,
          allowFailure: false,
          callData: POSITION_MANAGER_IFACE.encodeFunctionData('tokenOfOwnerByIndex', [TARGET_OWNER, ownerIndex]),
        },
      ]);
      const tokenIdRaw = decodeRequiredResult<bigint>(POSITION_MANAGER_IFACE, 'tokenOfOwnerByIndex', tokenIdResult);
      const tokenId = Number(tokenIdRaw);
      const [positionResult] = await runMulticall(provider, [
        {
          target: NONFUNGIBLE_POSITION_MANAGER,
          allowFailure: false,
          callData: POSITION_MANAGER_IFACE.encodeFunctionData('positions', [tokenId]),
        },
      ]);
      const position = decodeRequiredResult<any>(POSITION_MANAGER_IFACE, 'positions', positionResult);
      if (isPositionActiveForTargetPool(position)) {
        selectedTokenId = tokenId;
        selectedPosition = position;
        setCachedLpTokenId({
          tokenId,
          expiresAt: now + LP_TOKEN_ID_CACHE_TTL_MS,
        });
        break;
      }
    }
  }

  if (selectedTokenId !== null && selectedPosition !== null) {
    matchedPositionIds.push(selectedTokenId);
    activeCount = 1;

    const tickLower = Number(selectedPosition.tickLower);
    const tickUpper = Number(selectedPosition.tickUpper);
    const liquidity = BigInt(selectedPosition.liquidity);

    if (!lowerTickCache.has(tickLower) || !upperTickCache.has(tickUpper)) {
      const [lowerTickResult, upperTickResult] = await runMulticall(provider, [
        {
          target: WBTC_USDT_POOL,
          allowFailure: false,
          callData: POOL_IFACE.encodeFunctionData('ticks', [tickLower]),
        },
        {
          target: WBTC_USDT_POOL,
          allowFailure: false,
          callData: POOL_IFACE.encodeFunctionData('ticks', [tickUpper]),
        },
      ]);
      const lowerTickData = decodeRequiredResult<any>(POOL_IFACE, 'ticks', lowerTickResult);
      const upperTickData = decodeRequiredResult<any>(POOL_IFACE, 'ticks', upperTickResult);

      lowerTickCache.set(tickLower, {
        feeGrowthOutside0X128: BigInt(lowerTickData.feeGrowthOutside0X128),
        feeGrowthOutside1X128: BigInt(lowerTickData.feeGrowthOutside1X128),
      });
      upperTickCache.set(tickUpper, {
        feeGrowthOutside0X128: BigInt(upperTickData.feeGrowthOutside0X128),
        feeGrowthOutside1X128: BigInt(upperTickData.feeGrowthOutside1X128),
      });
    }

    const lower = lowerTickCache.get(tickLower)!;
    const upper = upperTickCache.get(tickUpper)!;

    const { totalToken0, totalToken1, wbtcPriceInUsdt } = calculatePositionMath({
      currentTick,
      tickLower,
      tickUpper,
      liquidity,
      sqrtPriceX96,
      feeGrowthGlobal0X128: BigInt(feeGrowthGlobal0),
      feeGrowthGlobal1X128: BigInt(feeGrowthGlobal1),
      lowerTickData: lower,
      upperTickData: upper,
      feeGrowthInside0LastX128: BigInt(selectedPosition.feeGrowthInside0LastX128),
      feeGrowthInside1LastX128: BigInt(selectedPosition.feeGrowthInside1LastX128),
      tokensOwed0: BigInt(selectedPosition.tokensOwed0),
      tokensOwed1: BigInt(selectedPosition.tokensOwed1),
      token0IsWbtc: TOKEN0_IS_WBTC,
    });

    let wbtcAmount = 0;
    let usdtAmount = 0;

    if (TOKEN0_IS_WBTC) {
      wbtcAmount = Number(ethers.formatUnits(totalToken0, 8));
      usdtAmount = Number(ethers.formatUnits(totalToken1, 6));
    } else {
      wbtcAmount = Number(ethers.formatUnits(totalToken1, 8));
      usdtAmount = Number(ethers.formatUnits(totalToken0, 6));
    }

    const usdValue = usdtAmount + wbtcAmount * wbtcPriceInUsdt;
    if (Number.isFinite(usdValue)) {
      totalUsd = usdValue;
    }
  }

  return {
    usdValueNumber: Number.isFinite(totalUsd) ? totalUsd : 0,
    usdValue: (Number.isFinite(totalUsd) ? totalUsd : 0).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }),
    apr24hPercent,
    apr24hLabel:
      apr24hPercent !== null
        ? `${apr24hPercent.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
        : null,
    positionIds: matchedPositionIds,
    activePositionsCount: activeCount,
  };
}
