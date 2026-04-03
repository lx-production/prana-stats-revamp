import React from 'react';
import { Landmark } from 'lucide-react';
import { useCapital } from '../hooks/useCapital';
import { useArbitrumWbtcUsdtLpValue } from '../hooks/useArbitrumWbtcUsdtLpValue';
import InfoTooltip from './InfoTooltip';

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

  const totalUsd = items.reduce((sum, item) => {
    if (item.tokenSymbol === 'USDT') {
      return sum + (item.amountValue || 0);
    }
    if (item.tokenSymbol === 'WBTC') {
      return sum + (item.usdValueNumber || 0);
    }
    return sum;
  }, 0) + (lpUsdValueNumber || 0);

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
                  <div className="text-xs text-cyan-300 uppercase tracking-wider">{network}</div>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {networkItems.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-gray-500 font-mono mt-1 break-all">{item.address}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white-200 font-semibold whitespace-nowrap">
                            {item.amount} {item.tokenSymbol}
                          </div>
                          {item.tokenSymbol === 'WBTC' && item.usdValue ? (
                            <div className="text-xs text-gray-400 mt-1 whitespace-nowrap">{item.usdValue}</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {network === 'Arbitrum' && !lpError ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-gray-500 font-mono break-all flex items-center gap-1 relative">
                            0x917d8fc3938FDB924332ad3B4771B234E5F468DC
                            <InfoTooltip
                              ariaLabel="LP position details"
                              text="Uniswap V3 LP WBTC/USDT"
                            />
                          </div>
                          <div className="text-xs text-gray-400 mt-1">24h APR: {apr24hLabel ?? 'N/A'}</div>
                        </div>
                        <div className="text-sm text-white-200 font-semibold whitespace-nowrap">{lpUsdValue}</div>
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
