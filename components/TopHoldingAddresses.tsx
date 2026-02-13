import React from 'react';
import { Lock, Wallet } from 'lucide-react';
import { useTopHoldingAddresses } from '../hooks/useTopHoldingAddresses';
import { formatInteger } from '../utils/formatters';

export const TopHoldingAddresses: React.FC = () => {
  const nonCirculatingRanks = new Set([1, 2, 3, 5]);
  const { holders, totalHolders, generatedAt, currentPage, startIndex, goToPage, isLoading, error } = useTopHoldingAddresses();

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 relative z-10">
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
                Top Holding Addresses
              </div>
              <div className="text-xs text-gray-400">
                {generatedAt ? `Updated: ${new Date(generatedAt).toLocaleString()}` : 'Showing latest cached snapshot'}
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {isLoading ? 'Loading balances...' : `${totalHolders} addresses`}
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
                const rank = startIndex + index + 1;
                const isNonCirculating = nonCirculatingRanks.has(rank);
                const balanceValue = Number(holder.balance);
                const formattedBalance = Number.isFinite(balanceValue) ? formatInteger(Math.round(balanceValue)) : '0';

                return (
                  <div
                    key={holder.address}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xs text-gray-500 w-7">{rank}.</div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-100 truncate">{holder.label}</div>
                        <div className="text-xs text-gray-500 font-mono break-all">{holder.address}</div>
                        {isNonCirculating ? (
                          <div className="mt-2 inline-flex items-end gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide leading-none text-amber-300">
                            <Lock className="w-3 h-3 shrink-0 self-end" />
                            <span className="leading-none">HODL - Non-Circulating</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-sm text-cyan-200 font-semibold whitespace-nowrap">
                      {formattedBalance} PRANA
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!isLoading && !error ? (
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-200 disabled:opacity-50"
              >
                Page 1
              </button>
              <button
                type="button"
                onClick={() => goToPage(2)}
                disabled={currentPage === 2}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-200 disabled:opacity-50"
              >
                Page 2
              </button>
              <span className="text-xs text-gray-500">Showing {startIndex + 1}-{startIndex + holders.length}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default TopHoldingAddresses;
