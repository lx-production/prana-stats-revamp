import type { CapitalApiResponse } from '../../types/api.types.ts';
import { ethers } from 'ethers';
import { loadBondSnapshot } from './bondMetrics.ts';
import { loadPranaPricesBundle } from './pranaPrices.ts';
import { SELL_BOND_ADDRESS_V2 } from '../../constants/bonds.ts';
import { getServerArbitrumProvider, getServerPolygonProvider } from '../utils/providers.ts';
import { MINIMAL_ERC20_ABI, MULTICALL3_ABI, MULTICALL3_ADDRESS } from '../../constants/sharedContracts.ts';

const TREZOR_1 = '0x696b00596F553FcF6F98EeBfD58F48d2645D7E1b';
const METAMASK = '0x1d791aca381c844c4e497fca9429dbe5d36ff1bc';

const USDT_POLYGON_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const USDT_ARBITRUM_ADDRESS = '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9';
const USDT_DECIMALS = 6;
const WBTC_DECIMALS = 8;

const ERC20_IFACE = new ethers.Interface(MINIMAL_ERC20_ABI);

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

export async function loadCapital(): Promise<CapitalApiResponse> {
  const [polygonProvider, arbitrumProvider] = await Promise.all([
    getServerPolygonProvider(),
    getServerArbitrumProvider(),
  ]);

  const polygonMulticall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, polygonProvider);
  const usdtArbitrum = new ethers.Contract(USDT_ARBITRUM_ADDRESS, MINIMAL_ERC20_ABI, arbitrumProvider);

  const polygonCalls = [
    {
      target: USDT_POLYGON_ADDRESS,
      allowFailure: false,
      callData: ERC20_IFACE.encodeFunctionData('balanceOf', [TREZOR_1]),
    },
    {
      target: USDT_POLYGON_ADDRESS,
      allowFailure: false,
      callData: ERC20_IFACE.encodeFunctionData('balanceOf', [METAMASK]),
    },
  ];

  const [{ btcPriceUsd }, usdtArbitrumRaw, polygonResults, bondSnapshot] = await Promise.all([
    loadPranaPricesBundle(),
    usdtArbitrum.balanceOf(TREZOR_1),
    polygonMulticall.aggregate3.staticCall(polygonCalls) as Promise<MulticallResult[]>,
    loadBondSnapshot(),
  ]);

  const usdtPolygonRaw = decodeBalance(polygonResults[0], 'Polygon USDT Trezor 1');
  const usdtPolygonRawTrezor3 = decodeBalance(polygonResults[1], 'Polygon USDT MetaMask');
  const sellBondCapacityRaw =
    bondSnapshot.sellBalanceV2 > bondSnapshot.sellCommittedV2
      ? bondSnapshot.sellBalanceV2 - bondSnapshot.sellCommittedV2
      : 0n;

  const usdtPolygonAmount = Number(ethers.formatUnits(usdtPolygonRaw, USDT_DECIMALS));
  const usdtArbitrumAmount = Number(ethers.formatUnits(usdtArbitrumRaw, USDT_DECIMALS));
  const usdtPolygonAmountTrezor3 = Number(ethers.formatUnits(usdtPolygonRawTrezor3, USDT_DECIMALS));
  const wbtcAmount = Number(ethers.formatUnits(sellBondCapacityRaw, WBTC_DECIMALS));
  const wbtcUsdValue = wbtcAmount * btcPriceUsd;

  return {
    items: [
      {
        id: 'usdt-polygon',
        label: 'Capital Wallet',
        tokenSymbol: 'USDT',
        network: 'Polygon',
        address: TREZOR_1,
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
        address: TREZOR_1,
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
        address: METAMASK,
        amount: Number.isFinite(usdtPolygonAmountTrezor3)
          ? usdtPolygonAmountTrezor3.toLocaleString('en-US', { maximumFractionDigits: 2 })
          : '0',
        amountValue: Number.isFinite(usdtPolygonAmountTrezor3) ? usdtPolygonAmountTrezor3 : 0,
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
        usdValue: Number.isFinite(wbtcUsdValue)
          ? wbtcUsdValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
          : null,
        usdValueNumber: Number.isFinite(wbtcUsdValue) ? wbtcUsdValue : null,
      },
    ],
  };
}
