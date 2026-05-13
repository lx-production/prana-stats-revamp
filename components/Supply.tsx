import InfoTooltip from './InfoTooltip';
import React, { useMemo } from 'react';
import { Coins, ShoppingCart } from 'lucide-react';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import { useBondStats } from '../hooks/useBondStats';
import { formatNumber } from '../utils/formatters';
import { useTopHoldingAddresses } from '../hooks/useTopHoldingAddresses';

const TOTAL_SUPPLY = 10_000_000;
const NON_CIRCULATING_RANKS = new Set([1, 2, 3, 5]);
const BUYABLE_LABELS = new Set(['WBTC/PRANA DEX Pool', 'DEX Pool & Bonds Reserve']);

export const Supply: React.FC = () => {
  const { locale } = useSiteLanguage();
  const { holders, isLoading, error } = useTopHoldingAddresses();
  const {
    buyBondCapacityDisplay,
    isLoading: isBondStatsLoading,
  } = useBondStats();

  const circulatingSupply = useMemo(() => {
    const nonCirculating = holders.reduce((sum, holder, index) => {
      const rank = index + 1;
      if (!NON_CIRCULATING_RANKS.has(rank)) return sum;
      const balanceValue = Number(holder.balance);
      if (!Number.isFinite(balanceValue)) return sum;
      return sum + balanceValue;
    }, 0);

    const remaining = TOTAL_SUPPLY - nonCirculating;
    return Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
  }, [holders]);

  const buyableSupply = useMemo(() => {
    const poolTotal = holders.reduce((sum, holder) => {
      if (!BUYABLE_LABELS.has(holder.label)) return sum;
      const balanceValue = Number(holder.balance);
      if (!Number.isFinite(balanceValue)) return sum;
      return sum + balanceValue;
    }, 0);

    const capacityPranaRaw = typeof buyBondCapacityDisplay === 'string'
      ? Number(buyBondCapacityDisplay.replace(/,/g, ''))
      : 0;
      
    const capacityPrana = Number.isFinite(capacityPranaRaw) ? capacityPranaRaw : 0;

    const total = poolTotal + capacityPrana;
    return Number.isFinite(total) ? total : 0;
  }, [holders, buyBondCapacityDisplay]);

  const formattedCirculating = formatNumber(Math.round(circulatingSupply));
  const formattedBuyable = formatNumber(Math.round(buyableSupply));

  const circulatingTooltipAria =
    locale === 'en' ? 'Circulating Supply explanation' : 'Giải thích Circulating Supply';
  const circulatingTooltipText =
    locale === 'en'
      ? 'Maximum supply (10M) less PRANA in HODL wallets. Lost PRANA (keys forgotten, etc.) has not been subtracted.'
      : 'Tổng cung tối đa (10M) trừ đi số PRANA nằm ở các địa chỉ HODL. Chưa trừ số PRANA nhiều người đã làm mất.';

  const buyableTooltipAria =
    locale === 'en' ? 'Buyable Supply explanation' : 'Giải thích Buyable Supply';
  const buyableTooltipText =
    locale === 'en'
      ? 'Total PRANA in the WBTC/PRANA DEX Pool, DEX Pool & Bonds Reserve, and BuyBond capacity.'
      : 'Tổng PRANA trong WBTC/PRANA DEX Pool, DEX Pool & Bonds Reserve, và BuyBond capacity.';

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-30">
      <div
        className="
          group relative overflow-visible rounded-2xl border border-white/10 bg-white/5
          backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/10
        "
        style={{ animation: 'fadeInUp 0.6s ease-out 0.3s backwards' }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                Supply Distribution
              </div>
            </div>
            <div className="text-xs text-gray-500">Total Max Supply: {formatNumber(TOTAL_SUPPLY)} PRANA</div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 flex items-center justify-center gap-2 relative">
                <Coins className="w-3.5 h-3.5 text-emerald-300" />
                Circulating Supply
                <InfoTooltip
                  ariaLabel={circulatingTooltipAria}
                  text={circulatingTooltipText}
                  widthClassName="w-[min(24rem,calc(100vw-2rem))]"
                />
              </div>
              <div className="mt-2 text-2xl font-semibold text-emerald-200 text-center">
                {isLoading ? 'Loading...' : `${formattedCirculating} PRANA`}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 flex items-center justify-center gap-2 relative">
                <ShoppingCart className="w-3.5 h-3.5 text-cyan-300" />
                Buyable Supply
                <InfoTooltip
                  ariaLabel={buyableTooltipAria}
                  text={buyableTooltipText}
                  widthClassName="w-[min(24rem,calc(100vw-2rem))]"
                />
              </div>
              <div className="mt-2 text-2xl font-semibold text-cyan-200 text-center">
                {isLoading || isBondStatsLoading ? 'Loading...' : `${formattedBuyable} PRANA`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Supply;
