import { ethers } from 'ethers';
import { erc20Abi } from 'viem';
import { formatUsd } from '../../utils/formatters.ts';
import { loadPranaPricesBundle } from './pranaPrices.ts';
import { ARBITRUM_USDT } from '../../constants/arbitrumWbtcUsdtLp.ts';
import { USDT_POLYGON_ADDRESS } from '../../constants/swapContracts.ts';
import { getServerArbitrumProvider, getServerPolygonProvider } from '../utils/providers.ts';
import { SELL_BOND_ADDRESS_V2, SELL_BOND_COMMITTED_WBTC_ABI } from '../../constants/bonds.ts';
import { BUY_DIPS_WALLET_ADDRESS, PRANA_PROTOCOL_ADDRESS } from '../../constants/protocolAddresses.ts';
import { MULTICALL3_ABI, MULTICALL3_ADDRESS, USDT_DECIMALS, WBTC_ADDRESS, WBTC_DECIMALS, WBTC_PRANA_V3_POOL } from '../../constants/sharedContracts.ts';

import type { CapitalApiResponse } from '../../types/api.types.ts';

const ERC20_IFACE = new ethers.Interface(erc20Abi);

type MulticallResult = {
  success?: boolean;
  returnData?: string;
};

function decodeBalance(result: MulticallResult, label: string): bigint {
  if (!result?.success || typeof result.returnData !== 'string') {
    throw new Error(`Failed to fetch ${label} balance`);
  }

  const [raw] = ERC20_IFACE.decodeFunctionResult('balanceOf', result.returnData);
  return typeof raw === 'bigint' ? raw : BigInt(raw?.toString?.() ?? '0');
}

async function loadSellBondCapacityRaw(provider: ethers.Provider): Promise<bigint> {
  const wbtcTokenContract = new ethers.Contract(WBTC_ADDRESS, erc20Abi, provider);
  const sellBondV2Contract = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_COMMITTED_WBTC_ABI, provider);

  const [sellCommittedV2, sellBalanceV2] = await Promise.all([
    sellBondV2Contract.committedWbtc() as Promise<bigint>,
    wbtcTokenContract.balanceOf(SELL_BOND_ADDRESS_V2) as Promise<bigint>,
  ]);

  return sellBalanceV2 > sellCommittedV2 ? sellBalanceV2 - sellCommittedV2 : 0n;
}

export async function loadCapital(): Promise<CapitalApiResponse> {
  const [polygonProvider, arbitrumProvider] = await Promise.all([
    getServerPolygonProvider(),
    getServerArbitrumProvider(),
  ]);

  const polygonMulticall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, polygonProvider);
  const usdtArbitrum = new ethers.Contract(ARBITRUM_USDT, erc20Abi, arbitrumProvider);

  const polygonCalls = [
    {
      target: USDT_POLYGON_ADDRESS,
      allowFailure: false,
      callData: ERC20_IFACE.encodeFunctionData('balanceOf', [PRANA_PROTOCOL_ADDRESS]),
    },
    {
      target: USDT_POLYGON_ADDRESS,
      allowFailure: false,
      callData: ERC20_IFACE.encodeFunctionData('balanceOf', [BUY_DIPS_WALLET_ADDRESS]),
    },
    {
      target: WBTC_ADDRESS,
      allowFailure: false,
      callData: ERC20_IFACE.encodeFunctionData('balanceOf', [WBTC_PRANA_V3_POOL]),
    },
  ];

  const [{ btcPriceUsd }, usdtArbitrumRaw, polygonResults, sellBondCapacityRaw] = await Promise.all([
    loadPranaPricesBundle(),
    usdtArbitrum.balanceOf(PRANA_PROTOCOL_ADDRESS),
    polygonMulticall.aggregate3.staticCall(polygonCalls) as Promise<MulticallResult[]>,
    loadSellBondCapacityRaw(polygonProvider),
  ]);

  const usdtPolygonRaw = decodeBalance(polygonResults[0], 'Polygon USDT PRANA Protocol');
  const usdtPolygonRawBuyDips = decodeBalance(polygonResults[1], 'Polygon USDT Buy Dips wallet');
  const wbtcPranaPoolRaw = decodeBalance(polygonResults[2], 'Polygon WBTC/PRANA pool WBTC reserve');

  const usdtPolygonAmount = Number(ethers.formatUnits(usdtPolygonRaw, USDT_DECIMALS));
  const usdtArbitrumAmount = Number(ethers.formatUnits(usdtArbitrumRaw, USDT_DECIMALS));
  const usdtPolygonAmountBuyDips = Number(ethers.formatUnits(usdtPolygonRawBuyDips, USDT_DECIMALS));
  const wbtcAmount = Number(ethers.formatUnits(sellBondCapacityRaw, WBTC_DECIMALS));
  const wbtcPranaPoolAmount = Number(ethers.formatUnits(wbtcPranaPoolRaw, WBTC_DECIMALS));
  const wbtcUsdValue = wbtcAmount * btcPriceUsd;
  const wbtcPranaPoolUsdValue = wbtcPranaPoolAmount * btcPriceUsd;

  return {
    items: [
      {
        id: 'usdt-polygon',
        label: 'Capital Wallet',
        tokenSymbol: 'USDT',
        network: 'Polygon',
        address: PRANA_PROTOCOL_ADDRESS,
        amount: Number.isFinite(usdtPolygonAmount)
          ? usdtPolygonAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })
          : '0',
        amountValue: Number.isFinite(usdtPolygonAmount) ? usdtPolygonAmount : 0,
        usdValue: null,
        usdValueNumber: null,
      },
      {
        id: 'usdt-arbitrum',
        label: 'Capital Wallet',
        tokenSymbol: 'USDT',
        network: 'Arbitrum',
        address: PRANA_PROTOCOL_ADDRESS,
        amount: Number.isFinite(usdtArbitrumAmount)
          ? usdtArbitrumAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })
          : '0',
        amountValue: Number.isFinite(usdtArbitrumAmount) ? usdtArbitrumAmount : 0,
        usdValue: null,
        usdValueNumber: null,
      },
      {
        id: 'usdt-polygon-2',
        label: 'Capital Wallet',
        tokenSymbol: 'USDT',
        network: 'Polygon',
        address: BUY_DIPS_WALLET_ADDRESS,
        amount: Number.isFinite(usdtPolygonAmountBuyDips)
          ? usdtPolygonAmountBuyDips.toLocaleString('en-US', { maximumFractionDigits: 2 })
          : '0',
        amountValue: Number.isFinite(usdtPolygonAmountBuyDips) ? usdtPolygonAmountBuyDips : 0,
        usdValue: null,
        usdValueNumber: null,
      },
      {
        id: 'wbtc',
        label: 'Capital Wallet',
        tokenSymbol: 'WBTC',
        network: 'Polygon',
        address: SELL_BOND_ADDRESS_V2,
        amount: Number.isFinite(wbtcAmount) ? wbtcAmount.toLocaleString('en-US', { maximumFractionDigits: 8 }) : '0',
        amountValue: Number.isFinite(wbtcAmount) ? wbtcAmount : 0,
        usdValue: Number.isFinite(wbtcUsdValue) ? formatUsd(wbtcUsdValue) : null,
        usdValueNumber: Number.isFinite(wbtcUsdValue) ? wbtcUsdValue : null,
      },
      {
        id: 'wbtc-prana-pool',
        label: 'Capital Wallet',
        tokenSymbol: 'WBTC',
        network: 'Polygon',
        address: WBTC_PRANA_V3_POOL,
        amount: Number.isFinite(wbtcPranaPoolAmount)
          ? wbtcPranaPoolAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })
          : '0',
        amountValue: Number.isFinite(wbtcPranaPoolAmount) ? wbtcPranaPoolAmount : 0,
        usdValue: Number.isFinite(wbtcPranaPoolUsdValue) ? formatUsd(wbtcPranaPoolUsdValue) : null,
        usdValueNumber: Number.isFinite(wbtcPranaPoolUsdValue) ? wbtcPranaPoolUsdValue : null,
      },
    ],
  };
}
