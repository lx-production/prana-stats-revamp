import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import type { LpCapitalData } from '../types/lpCapital.types';
import { getArbitrumProvider } from '../utils/arbitrumProvider';
import { fetchJsonSafe } from '../utils/fetchJson';
import { calculatePositionMath } from '../utils/uniswapV3Helpers';
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
} from '../constants/arbitrumWbtcUsdtLp';

const initialState: LpCapitalData = {
  usdValueNumber: 0,
  usdValue: '$0.00',
  apr24hPercent: null,
  apr24hLabel: null,
  positionIds: [],
  activePositionsCount: 0,
  isLoading: true,
  error: null,
};

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

let cachedLpTokenId: CachedLpTokenId | null = null;


export const useArbitrumWbtcUsdtLpValue = (): LpCapitalData => {
  const [state, setState] = useState<LpCapitalData>(initialState);

  const fetchLpValue = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const provider = getArbitrumProvider();
      const positionManager = new ethers.Contract(
        NONFUNGIBLE_POSITION_MANAGER,
        [...ERC721_ENUMERABLE_ABI, ...POSITION_MANAGER_ABI],
        provider
      );
      const pool = new ethers.Contract(WBTC_USDT_POOL, POOL_ABI, provider);
      const geckoPoolPromise = fetchJsonSafe<GeckoPoolResponse>(
        `https://api.geckoterminal.com/api/v2/networks/arbitrum/pools/${WBTC_USDT_POOL.toLowerCase()}`,
        {}
      );

      const [poolToken0, poolToken1, poolFee, slot0, feeGrowthGlobal0, feeGrowthGlobal1] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.fee(),
        pool.slot0(),
        pool.feeGrowthGlobal0X128(),
        pool.feeGrowthGlobal1X128(),
      ]);

      const geckoPool = await geckoPoolPromise;
      const targetPoolToken0 = String(poolToken0).toLowerCase();
      const targetPoolToken1 = String(poolToken1).toLowerCase();
      const targetPoolFee = BigInt(poolFee);
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

      const token0IsWbtc = targetPoolToken0 === ARBITRUM_WBTC;
      const token0IsUsdt = targetPoolToken0 === ARBITRUM_USDT;
      const token1IsWbtc = targetPoolToken1 === ARBITRUM_WBTC;
      const token1IsUsdt = targetPoolToken1 === ARBITRUM_USDT;

      if (!(token0IsWbtc || token1IsWbtc) || !(token0IsUsdt || token1IsUsdt)) {
        throw new Error('Target pool is not the expected WBTC/USDT pool on Arbitrum');
      }

      const isPositionActiveForTargetPool = (position: any) =>
        String(position.token0).toLowerCase() === targetPoolToken0 &&
        String(position.token1).toLowerCase() === targetPoolToken1 &&
        BigInt(position.fee) === targetPoolFee &&
        BigInt(position.liquidity) > 0n;

      let selectedTokenId: number | null = null;
      let selectedPosition: any | null = null;
      const now = Date.now();
      const hasValidCache = cachedLpTokenId !== null && cachedLpTokenId.expiresAt > now;

      if (hasValidCache) {
        try {
          const cachedPosition = await positionManager.positions(cachedLpTokenId.tokenId);
          if (isPositionActiveForTargetPool(cachedPosition)) {
            selectedTokenId = cachedLpTokenId.tokenId;
            selectedPosition = cachedPosition;
          } else {
            cachedLpTokenId = null;
          }
        } catch {
          cachedLpTokenId = null;
        }
      }

      if (!hasValidCache || cachedLpTokenId === null) {
        const ownerBalanceRaw = await positionManager.balanceOf(TARGET_OWNER);
        const ownerBalance = Number(ownerBalanceRaw);
        const tokenIdCalls = Array.from({ length: ownerBalance }, (_, i) =>
          positionManager.tokenOfOwnerByIndex(TARGET_OWNER, i)
        );
        const tokenIdsRaw: bigint[] = ownerBalance > 0 ? await Promise.all(tokenIdCalls) : [];
        const tokenIdsDesc = tokenIdsRaw.map((value) => Number(value)).sort((a, b) => b - a);

        for (const tokenId of tokenIdsDesc) {
          const position = await positionManager.positions(tokenId);
          if (isPositionActiveForTargetPool(position)) {
            selectedTokenId = tokenId;
            selectedPosition = position;
            cachedLpTokenId = {
              tokenId,
              expiresAt: now + LP_TOKEN_ID_CACHE_TTL_MS,
            };
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

        if (!lowerTickCache.has(tickLower)) {
          const tickData = await pool.ticks(tickLower);
          lowerTickCache.set(tickLower, {
            feeGrowthOutside0X128: BigInt(tickData.feeGrowthOutside0X128),
            feeGrowthOutside1X128: BigInt(tickData.feeGrowthOutside1X128),
          });
        }
        if (!upperTickCache.has(tickUpper)) {
          const tickData = await pool.ticks(tickUpper);
          upperTickCache.set(tickUpper, {
            feeGrowthOutside0X128: BigInt(tickData.feeGrowthOutside0X128),
            feeGrowthOutside1X128: BigInt(tickData.feeGrowthOutside1X128),
          });
        }

        const lower = lowerTickCache.get(tickLower)!;
        const upper = upperTickCache.get(tickUpper)!;

        const feeGrowthGlobal0X128 = BigInt(feeGrowthGlobal0);
        const feeGrowthGlobal1X128 = BigInt(feeGrowthGlobal1);

        const { totalToken0, totalToken1, wbtcPriceInUsdt } = calculatePositionMath({
          currentTick,
          tickLower,
          tickUpper,
          liquidity,
          sqrtPriceX96,
          feeGrowthGlobal0X128,
          feeGrowthGlobal1X128,
          lowerTickData: lower,
          upperTickData: upper,
          feeGrowthInside0LastX128: BigInt(selectedPosition.feeGrowthInside0LastX128),
          feeGrowthInside1LastX128: BigInt(selectedPosition.feeGrowthInside1LastX128),
          tokensOwed0: BigInt(selectedPosition.tokensOwed0),
          tokensOwed1: BigInt(selectedPosition.tokensOwed1),
          token0IsWbtc,
        });

        let wbtcAmount = 0;
        let usdtAmount = 0;

        if (token0IsWbtc) {
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

      setState({
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
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Failed to fetch LP value';

      setState({
        usdValueNumber: 0,
        usdValue: '$0.00',
        apr24hPercent: null,
        apr24hLabel: null,
        positionIds: [],
        activePositionsCount: 0,
        isLoading: false,
        error: message,
      });
    }
  }, []);

  useEffect(() => {
    fetchLpValue();
  }, [fetchLpValue]);

  return useMemo(() => state, [state]);
};
