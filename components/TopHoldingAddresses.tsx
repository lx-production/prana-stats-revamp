import React from 'react';
import { Lock, Wallet } from 'lucide-react';
import { useTopHoldingAddresses } from '../hooks/useTopHoldingAddresses';
import { formatNumber } from '../utils/formatters';
import InfoTooltip from './InfoTooltip';
import BuyDips from './BuyDips';

export const TopHoldingAddresses: React.FC = () => {
  const nonCirculatingRanks = new Set([1, 2, 3, 5]);
  const labelTooltips: Record<
    string,
    { text: string; ariaLabel: string; widthClassName?: string }
  > = {
    'PRANA Protocol': {
      text: 'Original Founders allocation and active Buy The Dips operations (no sell policy)',
      ariaLabel: 'PRANA Protocol info',
    },
    'Protocol Reserve': {
      text: 'Original Contribute to Earn, Engage to Earn program, Staking Interest reserve',
      ariaLabel: 'Protocol Reserve info',
    },
    'DEX Pool & Bonds Reserve': {
      text: 'Quỹ dự trữ cho WBTC/PRANA pool và hợp đồng Bonding OTC',
      ariaLabel: 'DEX Pool & Bonds Reserve info',
    },
    'PRANA Staking': {
      text: 'Lãi suất cố định 12% APR',
      ariaLabel: 'PRANA Staking info',
    },
  };
  const { holders, isLoading, error } = useTopHoldingAddresses();

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
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <a
                  href="https://polygonscan.com/token/0x928277e774f34272717eadfafc3fd802dafbd0f5#balances"
                  className="no-underline"
                  rel="noreferrer"
                  target="_blank"
                >
                  Top Holding Addresses
                </a>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`loading-${index}`}
                  className="h-12 rounded-xl border border-white/10 bg-white/5 animate-pulse"
                />
              ))
            ) : (
              holders.map((holder, index) => {
                const rank = index + 1;
                const isNonCirculating = nonCirculatingRanks.has(rank);
                const balanceValue = Number(holder.balance);
                const formattedBalance = Number.isFinite(balanceValue) ? formatNumber(Math.round(balanceValue)) : '0';

                return (
                <div
                  key={holder.address}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 flex flex-col gap-2"
                >
                  <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm text-gray-100">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">{rank}.</span>
                      <span className="font-semibold leading-tight">{holder.label}</span>
                      {labelTooltips[holder.label] ? (
                        <InfoTooltip
                          ariaLabel={labelTooltips[holder.label].ariaLabel}
                          text={labelTooltips[holder.label].text}
                          widthClassName={labelTooltips[holder.label].widthClassName}
                        />
                      ) : null}
                    </div>
                    <div className="flex justify-end">
                      {isNonCirculating ? (
                        <div className="inline-flex items-center justify-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide leading-none text-amber-300">
                          <Lock className="w-3 h-3 shrink-0" />
                          <span className="leading-none">HODL</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col min-w-0 gap-1">
                      <div className="text-xs text-gray-500 font-mono break-all">{holder.address}</div>
                    </div>
                    <div className="text-sm text-white-200 font-semibold whitespace-nowrap">
                      {formattedBalance} PRANA
                    </div>
                  </div>
                  {holder.label === 'PRANA Protocol' ? <BuyDips className="mt-2 w-full" /> : null}
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TopHoldingAddresses;
