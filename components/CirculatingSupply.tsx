import React, { useMemo } from 'react';
import { Coins, Lock } from 'lucide-react';
import { useTopHoldingAddresses } from '../hooks/useTopHoldingAddresses';
import { formatInteger } from '../utils/formatters';

const TOTAL_SUPPLY = 10_000_000;
const NON_CIRCULATING_RANKS = new Set([1, 2, 3, 5]);

export const CirculatingSupply: React.FC = () => {
  const { allHolders = [], isLoading, error, generatedAt } = useTopHoldingAddresses();

  const nonCirculatingTotal = useMemo(() => {
    return allHolders.reduce((sum, holder, index) => {
      const rank = index + 1;
      if (!NON_CIRCULATING_RANKS.has(rank)) return sum;
      const balanceValue = Number(holder.balance);
      if (!Number.isFinite(balanceValue)) return sum;
      return sum + balanceValue;
    }, 0);
  }, [allHolders]);

  const circulatingSupply = useMemo(() => {
    const remaining = TOTAL_SUPPLY - nonCirculatingTotal;
    return Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
  }, [nonCirculatingTotal]);

  const formattedCirculating = formatInteger(Math.round(circulatingSupply));
  const formattedNonCirculating = formatInteger(Math.round(nonCirculatingTotal));

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div
        className="
          group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5
          backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/10
        "
        style={{ animation: 'fadeInUp 0.6s ease-out 0.3s backwards' }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                Circulating Supply
              </div>
              <div className="text-xs text-gray-400">
                {generatedAt ? `Updated: ${new Date(generatedAt).toLocaleString()}` : 'Showing latest cached snapshot'}
              </div>
            </div>
            <div className="text-xs text-gray-500">Total Max Supply: {formatInteger(TOTAL_SUPPLY)} PRANA</div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <Coins className="w-3.5 h-3.5 text-emerald-300" />
                Circulating Supply
              </div>
              <div className="mt-2 text-2xl font-semibold text-emerald-200">
                {isLoading ? 'Loading...' : `${formattedCirculating} PRANA`}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                Non-Circulating Supply
              </div>
              <div className="mt-2 text-2xl font-semibold text-amber-200">
                {isLoading ? 'Loading...' : `${formattedNonCirculating} PRANA`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CirculatingSupply;
