import React, { useMemo } from 'react';
import { Activity, Lock, DollarSign } from 'lucide-react';
import { usePranaStats } from '../hooks/usePranaStats';
import { useStakingRunway } from '../hooks/useStakingRunway';
import { useStakingAdditionalCapacity } from '../hooks/useStakingAdditionalCapacity';
import { formatCurrency, formatNumber } from '../utils/formatters';
import BondingStats from './BondingStats';
import StatCard from './StatCard';
import InfoTooltip from './InfoTooltip';
import PerformanceCard from './PerformanceCard';

export const PranaStats: React.FC = () => {
  const {
    marketCapVnd,
    latestSatPrice,
    btcPriceUsd,
    stakedPrana,
    stakedVnd,
    interestContractBalancePrana,
    interestContractBalanceVnd,
    interestPrana,
    interestVnd,
    buyBondPrana,
    buyBondVnd,
    sellBondPrana,
    sellBondVnd,
    buyBondCommittedDisplay,
    buyBondCapacityDisplay,
    buyBondCommittedPercent,
    buyBondCapacityPercent,
    sellBondCommittedDisplay,
    sellBondCapacityDisplay,
    sellBondCommittedPercent,
    sellBondCapacityPercent,
    priceChange,
    priceChangeBtc,
    isLoading,
    error
  } = usePranaStats();

  const { runwayDays } = useStakingRunway({
    interestBalancePrana: interestContractBalancePrana,
    totalStakedPrana: stakedPrana,
    apr: 0.12,
  });

  const { additionalStakeCapacityPrana } = useStakingAdditionalCapacity({
    interestBalancePrana: interestContractBalancePrana,
    interestCommittedPrana: interestPrana,
    apr: 0.12,
  });

  const performanceMetricsBtc = useMemo(
    () => [
      { label: '1 Month', value: priceChangeBtc.m1 },
      { label: '3 Months', value: priceChangeBtc.m3 },
      { label: '6 Months', value: priceChangeBtc.m6 },
      { label: '1 Year', value: priceChangeBtc.y1 },
      { label: 'ATL', value: priceChangeBtc.atl },
    ],
    [priceChangeBtc]
  );

  const performanceMetrics = useMemo(
    () => [
      { label: '1 Month', value: priceChange.m1 },
      { label: '3 Months', value: priceChange.m3 },
      { label: '6 Months', value: priceChange.m6 },
      { label: '1 Year', value: priceChange.y1 },
      { label: 'ATL', value: priceChange.atl },
    ],
    [priceChange]
  );

  const pranaPriceUsd = (latestSatPrice ?? 0) / 1e8 * (btcPriceUsd ?? 0);

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

        <BondingStats
          isLoading={isLoading}
          buyBondPrana={buyBondPrana}
          buyBondVnd={buyBondVnd}
          sellBondPrana={sellBondPrana}
          sellBondVnd={sellBondVnd}
          buyBondCommittedDisplay={buyBondCommittedDisplay}
          buyBondCapacityDisplay={buyBondCapacityDisplay}
          buyBondCommittedPercent={buyBondCommittedPercent}
          buyBondCapacityPercent={buyBondCapacityPercent}
          sellBondCommittedDisplay={sellBondCommittedDisplay}
          sellBondCapacityDisplay={sellBondCapacityDisplay}
          sellBondCommittedPercent={sellBondCommittedPercent}
          sellBondCapacityPercent={sellBondCapacityPercent}
        />

        {/* Staked Value */}
        <StatCard
          title="Total Value Staked"
          mainValue={isLoading ? "Loading..." : `${formatCurrency(stakedPrana, 'PRANA')} PRANA`}
          subValue={`≈ ${formatCurrency(stakedVnd, 'VND')} VNĐ`}
          icon={Lock}
          delay={0.2}
          loading={isLoading}
        />

        {/* Interest Contract Balance */}
        <StatCard
          title="Staking Interest Balance"
          mainValue={isLoading ? "Loading..." : `${formatCurrency(interestContractBalancePrana, 'PRANA')} PRANA`}
          subValue={`≈ ${formatCurrency(interestContractBalanceVnd, 'VND')} VNĐ`}
          icon={Activity}
          className="z-30"
          delay={0.25}
          loading={isLoading}
          footer={
            runwayDays && Number.isFinite(runwayDays) ? (
              <div className="text-sm text-gray-400 font-mono flex flex-col gap-1.5 relative w-full">
                <div className="flex items-center gap-2">
                  <span>Runway: {Math.round(runwayDays).toLocaleString()} days</span>
                  <InfoTooltip
                    ariaLabel="Giải thích Runway"
                    text="Runway là ước tính số ngày quỹ PRANA trong Interest Contract có thể tiếp tục trả lãi cho stakers, giả định APR 12% và tổng PRANA đang stake giữ nguyên. Công thức: Runway = Interest Balance / (Total Staked * 0.12 / 365)"
                    widthClassName="w-[min(24rem,calc(100vw-2rem))]"
                  />
                </div>
              </div>
            ) : null
          }
        />

        {/* Interest Committed */}
        <StatCard
          title="Staking Interest Committed"
          mainValue={isLoading ? "Loading..." : `${formatCurrency(interestPrana, 'PRANA')} PRANA`}
          subValue={`≈ ${formatCurrency(interestVnd, 'VND')} VNĐ`}
          icon={Activity}
          delay={0.3}
          loading={isLoading}
          footer={
            additionalStakeCapacityPrana && Number.isFinite(additionalStakeCapacityPrana) ? (
              <div className="text-sm text-gray-400 font-mono flex flex-col gap-1.5 relative w-full">
                <div className="text-gray-400 flex items-center gap-2">
                  <span>
                    Capacity: {formatCurrency(additionalStakeCapacityPrana, 'PRANA')} PRANA
                  </span>
                  <InfoTooltip
                    ariaLabel="Giải thích Capacity"
                    widthClassName="w-[min(24rem,calc(100vw-2rem))]"
                    text="Capacity là ước tính lượng PRANA có thể stake thêm mà phần quỹ PRANA còn lại trong Interest Contract vẫn đủ để trả lãi với giả định APR cố định 12%. Công thức: Capacity ≈ (Interest Balance − Interest Committed) / 0.12"
                  />
                </div>
              </div>
            ) : null
          }
        />

        <PerformanceCard performanceMetrics={performanceMetricsBtc} compareLabel="PERFORMANCE VS BITCOIN" />
        <PerformanceCard performanceMetrics={performanceMetrics} compareLabel="PERFORMANCE VS FIAT" />
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
