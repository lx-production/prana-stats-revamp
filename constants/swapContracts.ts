import {
  POLYGON_CHAIN_ID,
  POLYGON_CHAIN_NAME,
  POLYGONSCAN_TX_BASE_URL,
} from './network.ts';
import { PRANA_ADDRESS, PRANA_DECIMALS, WBTC_ADDRESS, WBTC_DECIMALS, WBTC_PRANA_V3_POOL } from './sharedContracts.ts';

import type { HexAddress, SwapToken, SwapTokenSymbol } from '../types/swap.types.ts';

// Re-export network constants so existing swap imports keep working.
export { POLYGON_CHAIN_ID, POLYGON_CHAIN_NAME, POLYGONSCAN_TX_BASE_URL };

export const DEFAULT_SWAP_SLIPPAGE_BPS = 50; // 0.5%
export const SWAP_QUOTE_DEBOUNCE_MS = 650; // waits 650ms after the last change before fetching
export const SWAP_QUOTE_MANUAL_REFRESH_COOLDOWN_MS = 60_000;
export const SWAP_DEADLINE_SECONDS = 3 * 60; // 3 minutes

export const UNISWAP_SWAP_ROUTER_02_ADDRESS: HexAddress = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';

// Matches NEW_QUOTER_V2_ADDRESSES[ChainId.POLYGON] in @uniswap/smart-order-router@4.31.10.
export const UNISWAP_V3_QUOTER_V2_ADDRESS: HexAddress = '0x5e55C9e631FAE526cd4B0526C4818D6e0a9eF0e3';

export const QUOTER_V2_ABI = [
  'function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] sqrtPriceX96AfterList,uint32[] initializedTicksCrossedList,uint256 gasEstimate)',
];

// we don’t “use” every function here to build swaps, but validation treats them as allowed 
// so a real AlphaRouter tx isn’t rejected just because it includes wrap/unwrap/sweep/refund or a V2 leg
export const SWAP_ROUTER_02_ABI = [
  'function multicall(uint256 deadline,bytes[] data) payable returns (bytes[] results)',
  'function exactInput(tuple(bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)',
  'function exactInputSingle(tuple(address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
  'function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to) payable returns (uint256 amountOut)',
  'function wrapETH(uint256 value) payable',
  'function unwrapWETH9(uint256 amountMinimum,address recipient) payable',
  'function unwrapWETH9(uint256 amountMinimum) payable',
  'function sweepToken(address token,uint256 amountMinimum,address recipient) payable',
  'function sweepToken(address token,uint256 amountMinimum) payable',
  'function refundETH() payable',
];

export const WMATIC_ADDRESS: HexAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; // WPOL 
export const USDC_POLYGON_ADDRESS: HexAddress = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
export const USDT_POLYGON_ADDRESS: HexAddress = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
export const WETH_POLYGON_ADDRESS: HexAddress = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619';
export const DAI_POLYGON_ADDRESS: HexAddress = '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063';

export const V1_SWAP_TOKENS: SwapToken[] = [
  {
    symbol: 'PRANA',
    name: 'PRANA',
    address: PRANA_ADDRESS as HexAddress,
    decimals: PRANA_DECIMALS,
    kind: 'erc20',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: WBTC_ADDRESS as HexAddress,
    decimals: WBTC_DECIMALS,
    kind: 'erc20',
  },
  {
    symbol: 'POL',
    name: 'Polygon',
    decimals: 18,
    kind: 'native',
    wrappedAddress: WMATIC_ADDRESS,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: USDC_POLYGON_ADDRESS,
    decimals: 6,
    kind: 'erc20',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: USDT_POLYGON_ADDRESS,
    decimals: 6,
    kind: 'erc20',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: WETH_POLYGON_ADDRESS,
    decimals: 18,
    kind: 'erc20',
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: DAI_POLYGON_ADDRESS,
    decimals: 18,
    kind: 'erc20',
  },
];

export const DEFAULT_SWAP_TOKEN_IN_SYMBOL: SwapTokenSymbol = 'WBTC';
export const DEFAULT_SWAP_TOKEN_OUT_SYMBOL: SwapTokenSymbol = 'PRANA';

export const WBTC_PRANA_POOL_ADDRESS = WBTC_PRANA_V3_POOL;
