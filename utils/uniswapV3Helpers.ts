import { Q96, Q128, UINT256_MOD } from '../constants/arbitrumWbtcUsdtLp.ts';

/**
 * Performs subtraction in uint256 modulo arithmetic.
 * Returns (a - b) mod (2^256) to handle underflow.
 */
export const subIn256 = (a: bigint, b: bigint): bigint => {
  const result = a - b;
  return result >= 0n ? result : result + UINT256_MOD;
};

/**
 * Calculates the square root price ratio for a given tick in Uniswap V3.
 * Uses bit manipulation and precomputed constants for gas-efficient calculation.
 *
 * @param tick - The tick value to convert to sqrt price ratio
 * @returns The square root price ratio as a Q96.32 fixed-point number
 */
export const getSqrtRatioAtTick = (tick: number): bigint => {
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

/**
 * Calculates token amounts for a given liquidity amount within a price range.
 * This implements the Uniswap V3 concentrated liquidity math.
 *
 * @param sqrtPriceX96 - Current square root price as Q96.32 fixed-point
 * @param sqrtPriceAX96 - Lower bound square root price as Q96.32 fixed-point
 * @param sqrtPriceBX96 - Upper bound square root price as Q96.32 fixed-point
 * @param liquidity - Amount of liquidity to convert to token amounts
 * @returns Object with amount0 and amount1 representing token amounts
 */
export const getAmountsForLiquidity = (
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): { amount0: bigint; amount1: bigint } => {
  let sqrtA = sqrtPriceAX96;
  let sqrtB = sqrtPriceBX96;

  // Ensure sqrtA <= sqrtB (price bounds are ordered)
  if (sqrtA > sqrtB) {
    const tmp = sqrtA;
    sqrtA = sqrtB;
    sqrtB = tmp;
  }

  // Current price is below the lower bound
  if (sqrtPriceX96 <= sqrtA) {
    return {
      amount0: (liquidity * (sqrtB - sqrtA) * Q96) / (sqrtA * sqrtB),
      amount1: 0n,
    };
  }

  // Current price is within the bounds
  if (sqrtPriceX96 < sqrtB) {
    return {
      amount0: (liquidity * (sqrtB - sqrtPriceX96) * Q96) / (sqrtPriceX96 * sqrtB),
      amount1: (liquidity * (sqrtPriceX96 - sqrtA)) / Q96,
    };
  }

  // Current price is above the upper bound
  return {
    amount0: 0n,
    amount1: (liquidity * (sqrtB - sqrtA)) / Q96,
  };
};

type TickFeeGrowth = {
  feeGrowthOutside0X128: bigint;
  feeGrowthOutside1X128: bigint;
};

type PositionMathInput = {
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
  feeGrowthGlobal0X128: bigint;
  feeGrowthGlobal1X128: bigint;
  lowerTickData: TickFeeGrowth;
  upperTickData: TickFeeGrowth;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  token0IsWbtc: boolean;
};

type PositionMathOutput = {
  totalToken0: bigint;
  totalToken1: bigint;
  wbtcPriceInUsdt: number;
};

export const calculatePositionMath = ({
  currentTick,
  tickLower,
  tickUpper,
  liquidity,
  sqrtPriceX96,
  feeGrowthGlobal0X128,
  feeGrowthGlobal1X128,
  lowerTickData,
  upperTickData,
  feeGrowthInside0LastX128,
  feeGrowthInside1LastX128,
  tokensOwed0,
  tokensOwed1,
  token0IsWbtc,
}: PositionMathInput): PositionMathOutput => {
  const feeGrowthBelow0 =
    currentTick >= tickLower
      ? lowerTickData.feeGrowthOutside0X128
      : subIn256(feeGrowthGlobal0X128, lowerTickData.feeGrowthOutside0X128);
  const feeGrowthBelow1 =
    currentTick >= tickLower
      ? lowerTickData.feeGrowthOutside1X128
      : subIn256(feeGrowthGlobal1X128, lowerTickData.feeGrowthOutside1X128);

  const feeGrowthAbove0 =
    currentTick < tickUpper
      ? upperTickData.feeGrowthOutside0X128
      : subIn256(feeGrowthGlobal0X128, upperTickData.feeGrowthOutside0X128);
  const feeGrowthAbove1 =
    currentTick < tickUpper
      ? upperTickData.feeGrowthOutside1X128
      : subIn256(feeGrowthGlobal1X128, upperTickData.feeGrowthOutside1X128);

  const feeGrowthInside0Now = subIn256(subIn256(feeGrowthGlobal0X128, feeGrowthBelow0), feeGrowthAbove0);
  const feeGrowthInside1Now = subIn256(subIn256(feeGrowthGlobal1X128, feeGrowthBelow1), feeGrowthAbove1);

  const feeDelta0 = subIn256(feeGrowthInside0Now, feeGrowthInside0LastX128);
  const feeDelta1 = subIn256(feeGrowthInside1Now, feeGrowthInside1LastX128);

  const uncollected0 = tokensOwed0 + (liquidity * feeDelta0) / Q128;
  const uncollected1 = tokensOwed1 + (liquidity * feeDelta1) / Q128;

  const sqrtLower = getSqrtRatioAtTick(tickLower);
  const sqrtUpper = getSqrtRatioAtTick(tickUpper);
  const principal = getAmountsForLiquidity(sqrtPriceX96, sqrtLower, sqrtUpper, liquidity);

  const totalToken0 = principal.amount0 + uncollected0;
  const totalToken1 = principal.amount1 + uncollected1;

  const priceToken1PerToken0 = Math.pow(1.0001, currentTick) * Math.pow(10, 8 - 6);
  const wbtcPriceInUsdt = token0IsWbtc ? priceToken1PerToken0 : 1 / priceToken1PerToken0;

  return {
    totalToken0,
    totalToken1,
    wbtcPriceInUsdt,
  };
};