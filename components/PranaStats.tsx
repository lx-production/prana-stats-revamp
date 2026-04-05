import React, { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { initialPranaStats } from '../constants/pranaStats';
import { usePrana365Data } from '../hooks/usePrana365Data';
import { usePranaStats } from '../hooks/usePranaStats';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { buildFiatPriceChangeFrom365 } from '../utils/pranaStatsPerformance';
import BondingStats from './BondingStats';
import PranaPerformanceSection from './PranaPerformanceSection';
import StatCard from './StatCard';
import StakingStats from './StakingStats';

export const PranaStats: React.FC = () => {
  const {
    marketCapVnd,
    latestSatPrice,
    btcPriceUsd,
    priceChangeBtc,
    isLoading,
    error
  } = usePranaStats();
  const { data: d365, isLoading: isPrana365Loading, error: prana365Error } = usePrana365Data();

  const pranaPriceUsd = (latestSatPrice ?? 0) / 1e8 * (btcPriceUsd ?? 0);
  const priceChange = useMemo(() => {
    if (typeof btcPriceUsd !== 'number' || typeof latestSatPrice !== 'number') {
      return initialPranaStats.priceChange;
    }

    return buildFiatPriceChangeFrom365({
      btcPriceUsd,
      latestSatPrice,
      d365,
    });
  }, [btcPriceUsd, latestSatPrice, d365]);

  return (
    <section className="w-full max-w-7xl mx-auto mt-12 px-4 sm:px-6 lg:px-8 relative z-20">
      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 items-stretch">
        {/* Market Cap - Highlighted */}
        <StatCard
          title="Market Cap"
          mainValue={
            isLoading ? (
              "Loading..."
            ) : (
              <div className="flex flex-col gap-1">
                <span>{`${formatCurrency(marketCapVnd, 'VND')} VNĐ`}</span>
                <span className="text-base sm:text-base font-medium text-white mt-4">
                  {`1 PRANA ≈ ${formatNumber(latestSatPrice ?? 0, 2)} SAT ≈ ${formatNumber(pranaPriceUsd ?? 0, 4)} USD`}
                </span>
              </div>
            )
          }
          icon={DollarSign}
          highlight={true}
          delay={0.1}
          loading={isLoading}
          footer={
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              Fully Diluted Valuation
            </div>
          }
        />

        <BondingStats />

        <StakingStats />

        <PranaPerformanceSection
          priceChange={priceChange}
          priceChangeBtc={priceChangeBtc}
          isLoading={isLoading}
          fiatLoading={isPrana365Loading}
          fiatError={prana365Error}
        />
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shine {
          100% { left: 125%; }
        }
      `}</style>
    </section>
  );
};

export default PranaStats;
