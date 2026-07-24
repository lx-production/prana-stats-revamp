import React from 'react';
import InfoTooltip from './InfoTooltip';
import { Landmark } from 'lucide-react';
import { useCapital } from '../hooks/useCapital';
import { SELL_BOND_ADDRESS_V2 } from '../constants/bonds';
import { WBTC_PRANA_V3_POOL } from '../constants/sharedContracts';
import { computeProtocolCapitalUsd } from '../utils/protocolCapital';
import { PROTOCOL_RESERVE_ADDRESS } from '../constants/protocolAddresses';
import { useArbitrumWbtcUsdtLpValue } from '../hooks/useArbitrumWbtcUsdtLpValue';

export const Capital: React.FC = () => {
  const { items, isLoading, error } = useCapital();

  const {
    usdValue: lpUsdValue,
    usdValueNumber: lpUsdValueNumber,
    apr24hLabel,
    isLoading: isLpLoading,
    error: lpError,
  } = useArbitrumWbtcUsdtLpValue();

  const groupedItems = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.network]) {
      acc[item.network] = [];
    }
    acc[item.network].push(item);
    return acc;
  }, {});

  const totalUsd = computeProtocolCapitalUsd(items, lpUsdValueNumber);

  const formattedTotalUsd = totalUsd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div
        className="
          group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5
          backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/10
        "
        style={{ animation: 'fadeInUp 0.6s ease-out 0.2s backwards' }}
      >
        <div className="p-5 sm:p-6">
          <div className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2 relative">
            <Landmark className="w-4 h-4 text-cyan-400" />
            Protocol Controlled Capital
            <InfoTooltip
              ariaLabel="Capital info"
              text="Buy the Dips Reserve"
            />
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {lpError ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {lpError}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-2">
            {isLoading || isLpLoading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`capital-loading-${index}`}
                  className="h-12 rounded-xl border border-white/10 bg-white/5 animate-pulse"
                />
              ))
            ) : (
              Object.entries(groupedItems).map(([network, networkItems]) => (
                <div key={network} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs text-cyan-300 uppercase tracking-wider mb-4">{network}</div>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {networkItems.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-gray-500 font-mono mt-1 break-all flex items-start gap-1 relative">
                            {item.address}
                            {network === 'Polygon' && item.address === SELL_BOND_ADDRESS_V2 ? (
                              <InfoTooltip
                                ariaLabel="Sell bond capacity details"
                                text="Sell Bond Capacity"
                              />
                            ) : network === 'Polygon' && item.address === WBTC_PRANA_V3_POOL ? (
                              <InfoTooltip
                                ariaLabel="WBTC/PRANA DEX pool details"
                                text="WBTC/PRANA DEX Pool"
                              />
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white-200 font-semibold whitespace-nowrap">
                            {item.amount} {item.tokenSymbol}
                          </div>
                          <div
                            className={
                              item.tokenSymbol === 'WBTC' && item.usdValue
                                ? 'text-xs text-gray-400 whitespace-nowrap'
                                : 'text-xs text-gray-400 invisible whitespace-nowrap select-none'
                            }
                            aria-hidden={!(item.tokenSymbol === 'WBTC' && item.usdValue)}
                          >
                            {item.tokenSymbol === 'WBTC' && item.usdValue ? item.usdValue : '\u00a0'}
                          </div>
                        </div>
                      </div>
                    ))}
                    {network === 'Arbitrum' && !lpError ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-gray-500 font-mono break-all flex items-start gap-1 relative">
                            {PROTOCOL_RESERVE_ADDRESS}
                            <InfoTooltip
                              ariaLabel="LP position details"
                              text="Uniswap V3 LP WBTC/USDT"
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={
                              lpUsdValue ? 'text-xs text-white-200 font-semibold whitespace-nowrap' : 'text-xs text-gray-400 invisible whitespace-nowrap select-none'
                            }
                            aria-hidden={!lpUsdValue}
                          >
                            {lpUsdValue ? lpUsdValue : '\u00a0'}
                          </div>
                          <div className="text-xs text-gray-400 whitespace-nowrap">
                            24h APR: {apr24hLabel ?? 'N/A'}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {!isLoading && !isLpLoading && !error && !lpError ? (
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-sm text-cyan-200 font-semibold uppercase tracking-wider">Total</div>
                <div className="text-sm text-cyan-100 font-semibold whitespace-nowrap">{formattedTotalUsd}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Capital;
