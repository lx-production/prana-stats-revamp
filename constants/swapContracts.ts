import { PRANA_ADDRESS, PRANA_DECIMALS, WBTC_ADDRESS, WBTC_DECIMALS, WBTC_PRANA_V3_POOL } from './sharedContracts.ts';
import type { HexAddress, SwapToken, SwapTokenSymbol } from '../types/swap.types.ts';

export const POLYGON_CHAIN_ID = 137;
export const POLYGON_CHAIN_NAME = 'Polygon';
export const DEFAULT_SWAP_SLIPPAGE_BPS = 50; // 0.5%
export const SWAP_QUOTE_DEBOUNCE_MS = 650;
export const SWAP_DEADLINE_SECONDS = 20 * 60;

export const UNISWAP_SWAP_ROUTER_02_ADDRESS: HexAddress = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
export const UNISWAP_V3_QUOTER_V2_ADDRESS: HexAddress = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
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

export function getSwapToken(symbol: SwapTokenSymbol): SwapToken {
  const token = V1_SWAP_TOKENS.find((item) => item.symbol === symbol);

  if (!token) {
    throw new Error(`Unsupported swap token: ${symbol}`);
  }

  return token;
}

export function getSwapTokenByAddress(address: string): SwapToken | undefined {
  const normalizedAddress = address.toLowerCase();

  return V1_SWAP_TOKENS.find((token) => {
    if (token.address?.toLowerCase() === normalizedAddress) return true;
    return token.wrappedAddress?.toLowerCase() === normalizedAddress;
  });
}
