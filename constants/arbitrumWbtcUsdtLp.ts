// Arbitrum WBTC/USDT LP Constants
import { SERVER_CACHE_TTL_MS } from './cachePolicy.js';

// Contract addresses
export const NONFUNGIBLE_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
export const WBTC_USDT_POOL = '0x5969EFddE3cF5C0D9a88aE51E47d721096A97203';
export const TARGET_OWNER = '0x917d8fc3938FDB924332ad3B4771B234E5F468DC';

// Pool configuration
export const POOL_FEE = 0.0005; // 0.05%
export const LP_TOKEN_ID_CACHE_TTL_MS = SERVER_CACHE_TTL_MS.lpTokenId;

// Token addresses
export const ARBITRUM_USDT = '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9';
export const ARBITRUM_WBTC = '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f';

// Mathematical constants
export const Q96 = 2n ** 96n;
export const Q128 = 2n ** 128n;
export const UINT256_MOD = 2n ** 256n;

// Contract ABIs
export const ERC721_ENUMERABLE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
];

export const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
];

export const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function ticks(int24 tick) view returns (uint128 liquidityGross,int128 liquidityNet,uint256 feeGrowthOutside0X128,uint256 feeGrowthOutside1X128,int56 tickCumulativeOutside,uint160 secondsPerLiquidityOutsideX128,uint32 secondsOutside,bool initialized)',
];