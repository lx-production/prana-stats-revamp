import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { MULTICALL3_ABI, MULTICALL3_ADDRESS, WBTC_ADDRESS } from '../constants/sharedContracts';
import type { CapitalData } from '../types/capital.types';
import { getPolygonProvider } from '../utils/polygonProvider';
import { getArbitrumProvider } from '../utils/arbitrumProvider';
import { fetchPranaPricesBundle } from '../utils/pranaPrices';

const TREZOR_1 = '0x696b00596F553FcF6F98EeBfD58F48d2645D7E1b';
const TREZOR_2 = '0x917d8fc3938FDB924332ad3B4771B234E5F468DC';
const METAMASK = '0x1d791aca381c844c4e497fca9429dbe5d36ff1bc';

const USDT_POLYGON_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const USDT_ARBITRUM_ADDRESS = '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9';
const USDT_DECIMALS = 6;
const WBTC_DECIMALS = 8;

const ERC20_BALANCE_OF_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const ERC20_IFACE = new ethers.Interface(ERC20_BALANCE_OF_ABI);

type MulticallResult = {
  success?: boolean;
  returnData?: string;
};

const initialState: CapitalData = {
  items: [],
  isLoading: true,
  error: null,
};

export const useCapital = (): CapitalData => {
  const [state, setState] = useState<CapitalData>(initialState);

  const fetchBalances = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const polygonProvider = getPolygonProvider();
      const arbitrumProvider = getArbitrumProvider();
      const polygonMulticall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, polygonProvider);
      const usdtArbitrum = new ethers.Contract(USDT_ARBITRUM_ADDRESS, ERC20_BALANCE_OF_ABI, arbitrumProvider);

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
        {
          target: WBTC_ADDRESS,
          allowFailure: false,
          callData: ERC20_IFACE.encodeFunctionData('balanceOf', [TREZOR_2]),
        },
      ];

      const [
        { btcPriceUsd },
        usdtArbitrumRaw,
        polygonResults,
      ] = await Promise.all([
        fetchPranaPricesBundle(),
        usdtArbitrum.balanceOf(TREZOR_1),
        polygonMulticall.aggregate3.staticCall(polygonCalls) as Promise<MulticallResult[]>,
      ]);

      const decodeBalance = (result: MulticallResult, label: string): bigint => {
        if (!result?.success || typeof result.returnData !== 'string') {
          throw new Error(`Failed to fetch ${label} balance`);
        }

        const [raw] = ERC20_IFACE.decodeFunctionResult('balanceOf', result.returnData);
        return typeof raw === 'bigint' ? raw : BigInt(raw?.toString?.() ?? '0');
      };

      const usdtPolygonRaw = decodeBalance(polygonResults[0], 'Polygon USDT Trezor 1');
      const usdtPolygonRawTrezor3 = decodeBalance(polygonResults[1], 'Polygon USDT MetaMask');
      const wbtcRaw = decodeBalance(polygonResults[2], 'Polygon WBTC Trezor 2');

      const usdtPolygonAmount = Number(ethers.formatUnits(usdtPolygonRaw, USDT_DECIMALS));
      const usdtArbitrumAmount = Number(ethers.formatUnits(usdtArbitrumRaw, USDT_DECIMALS));
      const usdtPolygonAmountTrezor3 = Number(ethers.formatUnits(usdtPolygonRawTrezor3, USDT_DECIMALS));
      const wbtcAmount = Number(ethers.formatUnits(wbtcRaw, WBTC_DECIMALS));
      const wbtcUsdValue = wbtcAmount * btcPriceUsd;

      setState({
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
            address: TREZOR_2,
            amount: Number.isFinite(wbtcAmount) ? wbtcAmount.toLocaleString('en-US', { maximumFractionDigits: 8 }) : '0',
            amountValue: Number.isFinite(wbtcAmount) ? wbtcAmount : 0,
            usdValue: Number.isFinite(wbtcUsdValue)
              ? wbtcUsdValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
              : null,
            usdValueNumber: Number.isFinite(wbtcUsdValue) ? wbtcUsdValue : null,
          },
        ],
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0 ? error.message : 'Failed to fetch capital balances';

      setState({
        items: [],
        isLoading: false,
        error: message,
      });
    }
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return useMemo(() => state, [state]);
};
