import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown, Activity, Lock, TrendingUp, DollarSign, BarChart3, Info } from 'lucide-react';
import { usePranaStats } from '../hooks/usePranaStats';
import { useStakingRunway } from '../hooks/useStakingRunway';
import { useStakingAdditionalCapacity } from '../hooks/useStakingAdditionalCapacity';
import { StatCardProps } from '../types';
import { formatCurrency } from '../utils/formatters';

const StatCard: React.FC<StatCardProps> = ({
  title,
  mainValue,
  subValue,
  icon: Icon,
  delay = 0,
  loading = false,
  highlight = false,
  className = '',
  footer,
}) => {
  return (
    <div
      className={`
        group relative z-10 hover:z-30 focus-within:z-40 rounded-2xl border transition-all duration-500
        ${highlight 
          ? 'border-cyan-500/30 bg-cyan-950/10 shadow-[0_0_30px_rgba(8,145,178,0.1)]' 
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
        }
        backdrop-blur-md
        ${className}
      `}
      style={{
        animation: `fadeInUp 0.6s ease-out ${delay}s backwards`
      }}
    >
      {/* Glow Effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-0 group-hover:animate-shine" />
      </div>
      
      <div className="p-5 flex flex-col h-full relative z-10">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-cyan-400" />}
            {title}
          </h3>
        </div>

        <div className="flex flex-col gap-1">
          {loading ? (
            <div className="h-8 w-32 bg-white/10 animate-pulse rounded" />
          ) : (
            <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${highlight ? 'text-cyan-100' : 'text-white'}`}>
              {mainValue}
              <span className="text-sm font-normal text-gray-500 ml-2">
                {typeof mainValue === 'string' && mainValue.includes('VNĐ') ? '' : ''}
              </span>
            </div>
          )}
          
          {subValue && (
            <div className="text-sm text-gray-400 font-mono mt-0.5">
              {loading ? <div className="h-4 w-24 bg-white/10 animate-pulse rounded" /> : subValue}
            </div>
          )}
        </div>

        {footer && (
          <div className="mt-auto pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const PranaStats: React.FC = () => {
  const {
    marketCapVnd,
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

  const performanceMetrics = useMemo(
    () => [
      { label: '1 Tháng', value: priceChange.m1 },
      { label: '3 Tháng', value: priceChange.m3 },
      { label: '6 Tháng', value: priceChange.m6 },
      { label: '1 Năm', value: priceChange.y1 },
      { label: 'ATL', value: priceChange.atl },
    ],
    [priceChange]
  );

  const BondBreakdown: React.FC<{
    loading: boolean;
    balanceValue?: string;
    committedValue?: string;
    unit: string;
  }> = ({ loading, balanceValue, committedValue, unit }) => {
    return (
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-start gap-2">
          <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400/90 shrink-0" />
          <div className="leading-tight">
            <div className="text-gray-300 font-medium">Balance</div>
            <div className="text-gray-400 font-mono">
              {loading ? (
                <div className="h-4 w-24 bg-white/10 animate-pulse rounded mt-1" />
              ) : (
                <>
                  {balanceValue ?? '—'} {unit}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400/90 shrink-0" />
          <div className="leading-tight">
            <div className="text-gray-300 font-medium">Committed</div>
            <div className="text-gray-400 font-mono">
              {loading ? (
                <div className="h-4 w-24 bg-white/10 animate-pulse rounded mt-1" />
              ) : (
                <>
                  {committedValue ?? '—'} {unit}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const BondProgressBar: React.FC<{
    loading: boolean;
    committedValue?: string;
    capacityValue?: string;
    committedPercent?: number | null;
    capacityPercent?: number | null;
    unit: string;
  }> = ({ loading, committedValue, capacityValue, committedPercent, capacityPercent, unit }) => {
    const safeCommittedPercent =
      typeof committedPercent === 'number' && Number.isFinite(committedPercent)
        ? Math.min(100, Math.max(0, committedPercent))
        : 0;
    const safeCapacityPercent =
      typeof capacityPercent === 'number' && Number.isFinite(capacityPercent)
        ? Math.min(100, Math.max(0, capacityPercent))
        : Math.max(0, 100 - safeCommittedPercent);

    return (
      <div className="flex flex-col gap-3">
        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          {loading ? (
            <div className="h-full w-2/3 bg-white/10 animate-pulse" />
          ) : (
            <div className="h-full w-full flex">
              <div
                className="h-full bg-emerald-400/90"
                style={{ width: `${safeCommittedPercent}%` }}
                aria-label="Committed"
              />
              <div
                className="h-full bg-indigo-400/90"
                style={{ width: `${safeCapacityPercent}%` }}
                aria-label="Capacity"
              />
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400/90 shrink-0" />
            <div className="leading-tight">
              <div className="text-gray-300 font-medium">Committed</div>
              <div className="text-gray-400 font-mono">
                {loading ? (
                  <div className="h-4 w-28 bg-white/10 animate-pulse rounded mt-1" />
                ) : (
                  <>
                    {committedValue ?? '—'} {unit}
                    <span className="text-gray-500 ml-2">
                      ({Math.round(safeCommittedPercent)}%)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400/90 shrink-0" />
            <div className="leading-tight">
              <div className="text-gray-300 font-medium">Capacity</div>
              <div className="text-gray-400 font-mono">
                {loading ? (
                  <div className="h-4 w-28 bg-white/10 animate-pulse rounded mt-1" />
                ) : (
                  <>
                    {capacityValue ?? '—'} {unit}
                    <span className="text-gray-500 ml-2">
                      ({Math.round(safeCapacityPercent)}%)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="w-full max-w-7xl mx-auto mt-12 px-4 sm:px-6 lg:px-8 relative z-10">
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
          mainValue={isLoading ? "Loading..." : `${formatCurrency(marketCapVnd, 'VND')} VNĐ`}
          subValue="Fully Diluted Valuation"
          icon={DollarSign}
          highlight={true}
          delay={0.1}
          loading={isLoading}
        />

        {/* Buy Bond Volume */}
        <StatCard
          title="Buy Bond Volume"
          mainValue={isLoading ? "Loading..." : `${formatCurrency(buyBondPrana, 'PRANA')} PRANA`}
          subValue={`≈ ${formatCurrency(buyBondVnd, 'VND')} VNĐ`}
          icon={TrendingUp}
          delay={0.4}
          loading={isLoading}
          className="col-span-1"
          footer={
            <BondProgressBar
              loading={isLoading}
              committedValue={buyBondCommittedDisplay ?? undefined}
              capacityValue={buyBondCapacityDisplay ?? undefined}
              committedPercent={buyBondCommittedPercent}
              capacityPercent={buyBondCapacityPercent}
              unit="PRANA"
            />
          }
        />

        {/* Sell Bond Volume */}
        <StatCard
          title="Sell Bond Volume"
          mainValue={isLoading ? "Loading..." : `${formatCurrency(sellBondPrana, 'PRANA')} PRANA`}
          subValue={`≈ ${formatCurrency(sellBondVnd, 'VND')} VNĐ`}
          icon={BarChart3}
          delay={0.5}
          loading={isLoading}
          className="col-span-1"
          footer={
            <BondProgressBar
              loading={isLoading}
              committedValue={sellBondCommittedDisplay ?? undefined}
              capacityValue={sellBondCapacityDisplay ?? undefined}
              committedPercent={sellBondCommittedPercent}
              capacityPercent={sellBondCapacityPercent}
              unit="SAT"
            />
          }
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
            (runwayDays && Number.isFinite(runwayDays)) ||
            (additionalStakeCapacityPrana && Number.isFinite(additionalStakeCapacityPrana)) ? (
              <div className="text-sm text-gray-400 font-mono flex flex-col gap-1.5 relative w-full">
                {runwayDays && Number.isFinite(runwayDays) ? (
                  <div className="flex items-center gap-2">
                    <span>Runway: {Math.round(runwayDays).toLocaleString()} ngày</span>
                    <details className="font-sans">
                      <summary
                        className="cursor-pointer inline-flex items-center [&::-webkit-details-marker]:hidden"
                        aria-label="Giải thích Runway"
                        title="Giải thích Runway"
                      >
                        <Info className="w-4 h-4 text-cyan-400/80 hover:text-cyan-300 transition-colors" />
                      </summary>
                      <div
                        className="
                          absolute z-50 top-full mt-2 left-0
                          rounded-xl border border-white/10 bg-black/80 backdrop-blur-md
                          w-[min(24rem,calc(100vw-2rem))]
                          p-3 text-sm text-gray-200 shadow-[0_10px_30px_rgba(0,0,0,0.35)]
                        "
                      >
                        <div className="leading-relaxed">
                          Runway là ước tính số ngày quỹ PRANA trong Interest Contract có thể tiếp tục trả lãi
                          cho stakers, giả định APR 12% và tổng PRANA đang stake giữ nguyên.
                        </div>
                      </div>
                    </details>
                  </div>
                ) : null}

                {additionalStakeCapacityPrana && Number.isFinite(additionalStakeCapacityPrana) ? (
                  <div className="text-gray-400 flex items-center gap-2">
                    <span>
                      Capacity: +{formatCurrency(additionalStakeCapacityPrana, 'PRANA')} PRANA (APR 12%)
                    </span>
                    <details className="font-sans">
                      <summary
                        className="cursor-pointer inline-flex items-center [&::-webkit-details-marker]:hidden"
                        aria-label="Giải thích Capacity"
                        title="Giải thích Capacity"
                      >
                        <Info className="w-4 h-4 text-cyan-400/80 hover:text-cyan-300 transition-colors" />
                      </summary>
                      <div
                        className="
                          absolute z-50 top-full mt-2 left-0
                          rounded-xl border border-white/10 bg-black/80 backdrop-blur-md
                          w-[min(24rem,calc(100vw-2rem))]
                          p-3 text-sm text-gray-200 shadow-[0_10px_30px_rgba(0,0,0,0.35)]
                        "
                      >
                        <div className="leading-relaxed">
                          Capacity là ước tính lượng PRANA có thể stake thêm mà phần quỹ PRANA còn lại trong Interest Contract
                          vẫn đủ để trả lãi với giả định APR cố định 12%.
                          <br />
                          Công thức: Capacity ≈ (Interest Balance − Interest Committed) / 0.12
                        </div>
                      </div>
                    </details>
                  </div>
                ) : null}
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
        />

        {/* Performance Card (Consolidated Percentage Changes) */}
        <div
          className="group relative z-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-5 py-4 transition-all duration-500 hover:border-white/20 hover:bg-white/10 flex flex-col gap-4 lg:col-span-3"
          style={{ animation: `fadeInUp 0.6s ease-out 0.6s backwards` }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Performance
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {performanceMetrics.map(metric => {
              const isPositive = metric.value >= 0;
              return (
                <div key={metric.label} className="flex flex-col gap-1 rounded-xl border border-white/5 bg-white/0 px-3 py-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{metric.label}</span>
                  <div className={`text-sm font-semibold flex items-center ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? <ArrowUp className="w-3 h-3 mr-1"/> : <ArrowDown className="w-3 h-3 mr-1"/>}
                    {Math.abs(metric.value).toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
