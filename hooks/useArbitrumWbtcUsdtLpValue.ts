import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import type { LpCapitalData } from '../types/lpCapital.types';
import { getArbitrumProvider } from '../utils/arbitrumProvider';
import { fetchJsonSafe } from '../utils/fetchJson';

const NONFUNGIBLE_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const TARGET_POOL = '0x5969EFddE3cF5C0D9a88aE51E47d721096A97203';
const TARGET_OWNER = '0x917d8fc3938FDB924332ad3B4771B234E5F468DC';
const TARGET_POOL_FEE = 0.0005; // 0.05%

const ARBITRUM_USDT = '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9';
const ARBITRUM_WBTC = '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f';

const Q96 = 2n ** 96n;
const Q128 = 2n ** 128n;
const UINT256_MOD = 2n ** 256n;

const ERC721_ENUMERABLE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function ticks(int24 tick) view returns (uint128 liquidityGross,int128 liquidityNet,uint256 feeGrowthOutside0X128,uint256 feeGrowthOutside1X128,int56 tickCumulativeOutside,uint160 secondsPerLiquidityOutsideX128,uint32 secondsOutside,bool initialized)',
];

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

const subIn256 = (a: bigint, b: bigint) => {
  const result = a - b;
  return result >= 0n ? result : result + UINT256_MOD;
};

const getSqrtRatioAtTick = (tick: number): bigint => {
  const absTick = tick < 0 ? BigInt(-tick) : BigInt(tick);
  let ratio =
    (absTick & 0x1n) !== 0n
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;

  if ((absTick & 0x2n) !== 0n) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4n) !== 0n) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8n) !== 0n) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10n) !== 0n) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20n) !== 0n) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40n) !== 0n) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80n) !== 0n) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100n) !== 0n) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200n) !== 0n) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400n) !== 0n) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800n) !== 0n) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000n) !== 0n) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000n) !== 0n) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000n) !== 0n) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000n) !== 0n) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000n) !== 0n) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000n) !== 0n) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000n) !== 0n) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000n) !== 0n) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) {
    ratio = ((2n ** 256n) - 1n) / ratio;
  }

  const shifted = ratio >> 32n;
  return (ratio & ((1n << 32n) - 1n)) === 0n ? shifted : shifted + 1n;
};

const getAmountsForLiquidity = (
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
) => {
  let sqrtA = sqrtPriceAX96;
  let sqrtB = sqrtPriceBX96;

  if (sqrtA > sqrtB) {
    const tmp = sqrtA;
    sqrtA = sqrtB;
    sqrtB = tmp;
  }

  if (sqrtPriceX96 <= sqrtA) {
    return {
      amount0: (liquidity * (sqrtB - sqrtA) * Q96) / (sqrtA * sqrtB),
      amount1: 0n,
    };
  }

  if (sqrtPriceX96 < sqrtB) {
    return {
      amount0: (liquidity * (sqrtB - sqrtPriceX96) * Q96) / (sqrtPriceX96 * sqrtB),
      amount1: (liquidity * (sqrtPriceX96 - sqrtA)) / Q96,
    };
  }

  return {
    amount0: 0n,
    amount1: (liquidity * (sqrtB - sqrtA)) / Q96,
  };
};

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
      const pool = new ethers.Contract(TARGET_POOL, POOL_ABI, provider);
      const geckoPoolPromise = fetchJsonSafe<GeckoPoolResponse>(
        `https://api.geckoterminal.com/api/v2/networks/arbitrum/pools/${TARGET_POOL.toLowerCase()}`,
        {}
      );

      const [poolToken0, poolToken1, poolFee, slot0, feeGrowthGlobal0, feeGrowthGlobal1, ownerBalanceRaw] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.fee(),
        pool.slot0(),
        pool.feeGrowthGlobal0X128(),
        pool.feeGrowthGlobal1X128(),
        positionManager.balanceOf(TARGET_OWNER),
      ]);
      const geckoPool = await geckoPoolPromise;

      const ownerBalance = Number(ownerBalanceRaw);
      const tokenIdCalls = Array.from({ length: ownerBalance }, (_, i) => positionManager.tokenOfOwnerByIndex(TARGET_OWNER, i));
      const tokenIdsRaw: bigint[] = ownerBalance > 0 ? await Promise.all(tokenIdCalls) : [];
      const positionsRaw = tokenIdsRaw.length > 0
        ? await Promise.all(tokenIdsRaw.map((tokenId) => positionManager.positions(tokenId)))
        : [];

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
          ? (volume24hUsd * TARGET_POOL_FEE / tvlUsd) * 365 * 100
          : null;
      const apr24hPercent =
        apr24hPercentRaw !== null && Number.isFinite(apr24hPercentRaw) ? apr24hPercentRaw : null;

      for (let index = 0; index < positionsRaw.length; index += 1) {
        const tokenId = Number(tokenIdsRaw[index]);
        const position = positionsRaw[index];

        const samePool =
          String(position.token0).toLowerCase() === targetPoolToken0 &&
          String(position.token1).toLowerCase() === targetPoolToken1 &&
          BigInt(position.fee) === targetPoolFee;

        if (!samePool || BigInt(position.liquidity) <= 0n) {
          continue;
        }

        matchedPositionIds.push(tokenId);
        activeCount += 1;

        const tickLower = Number(position.tickLower);
        const tickUpper = Number(position.tickUpper);
        const liquidity = BigInt(position.liquidity);

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

        const feeGrowthBelow0 =
          currentTick >= tickLower
            ? lower.feeGrowthOutside0X128
            : subIn256(feeGrowthGlobal0X128, lower.feeGrowthOutside0X128);
        const feeGrowthBelow1 =
          currentTick >= tickLower
            ? lower.feeGrowthOutside1X128
            : subIn256(feeGrowthGlobal1X128, lower.feeGrowthOutside1X128);

        const feeGrowthAbove0 =
          currentTick < tickUpper
            ? upper.feeGrowthOutside0X128
            : subIn256(feeGrowthGlobal0X128, upper.feeGrowthOutside0X128);
        const feeGrowthAbove1 =
          currentTick < tickUpper
            ? upper.feeGrowthOutside1X128
            : subIn256(feeGrowthGlobal1X128, upper.feeGrowthOutside1X128);

        const feeGrowthInside0Now = subIn256(subIn256(feeGrowthGlobal0X128, feeGrowthBelow0), feeGrowthAbove0);
        const feeGrowthInside1Now = subIn256(subIn256(feeGrowthGlobal1X128, feeGrowthBelow1), feeGrowthAbove1);

        const feeGrowthInside0Last = BigInt(position.feeGrowthInside0LastX128);
        const feeGrowthInside1Last = BigInt(position.feeGrowthInside1LastX128);

        const feeDelta0 = subIn256(feeGrowthInside0Now, feeGrowthInside0Last);
        const feeDelta1 = subIn256(feeGrowthInside1Now, feeGrowthInside1Last);

        const uncollected0 = BigInt(position.tokensOwed0) + (liquidity * feeDelta0) / Q128;
        const uncollected1 = BigInt(position.tokensOwed1) + (liquidity * feeDelta1) / Q128;

        const sqrtLower = getSqrtRatioAtTick(tickLower);
        const sqrtUpper = getSqrtRatioAtTick(tickUpper);
        const principal = getAmountsForLiquidity(sqrtPriceX96, sqrtLower, sqrtUpper, liquidity);

        const totalToken0 = principal.amount0 + uncollected0;
        const totalToken1 = principal.amount1 + uncollected1;

        const token0IsWbtc = targetPoolToken0 === ARBITRUM_WBTC;
        const token0IsUsdt = targetPoolToken0 === ARBITRUM_USDT;
        const token1IsWbtc = targetPoolToken1 === ARBITRUM_WBTC;
        const token1IsUsdt = targetPoolToken1 === ARBITRUM_USDT;

        if (!(token0IsWbtc || token1IsWbtc) || !(token0IsUsdt || token1IsUsdt)) {
          throw new Error('Target pool is not the expected WBTC/USDT pool on Arbitrum');
        }

        const priceToken1PerToken0 = Math.pow(1.0001, currentTick) * Math.pow(10, 8 - 6);
        const wbtcPriceInUsdt = token0IsWbtc ? priceToken1PerToken0 : 1 / priceToken1PerToken0;

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
          totalUsd += usdValue;
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
