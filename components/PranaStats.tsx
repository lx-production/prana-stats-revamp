import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown, Activity, Lock, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { usePranaStats } from '../hooks/usePranaStats';

// --- Helper Types & Utilities ---

const formatCurrency = (value: number | null, currency: 'VND' | 'PRANA') => {
  if (value === null || value === undefined) return 'Loading...';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: currency === 'PRANA' ? 2 : 0,
    maximumFractionDigits: currency === 'PRANA' ? 2 : 0,
  });
};

const formatPercent = (value: number) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
};

// --- Components ---

interface StatCardProps {
  title: string;
  mainValue: string | number;
  subValue?: string;
  icon?: React.ElementType;
  trend?: number; // Percentage change for trend indicator
  trendLabel?: string;
  delay?: number;
  className?: string;
  loading?: boolean;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  mainValue,
  subValue,
  icon: Icon,
  trend,
  trendLabel,
  delay = 0,
  loading = false,
  highlight = false,
  className = '',
}) => {
  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl border transition-all duration-500
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
      <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-0 group-hover:animate-shine" />
      
      <div className="p-5 flex flex-col h-full justify-between relative z-10">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-cyan-400" />}
            {title}
          </h3>
          {trend !== undefined && (
            <div className={`
              flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full
              ${trend > 0 ? 'bg-green-500/20 text-green-400' : trend < 0 ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}
            `}>
              {trend > 0 ? <ArrowUp className="w-3 h-3" /> : trend < 0 ? <ArrowDown className="w-3 h-3" /> : null}
              {formatPercent(trend)}
              {trendLabel && <span className="ml-1 opacity-70 font-normal">{trendLabel}</span>}
            </div>
          )}
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
      </div>
    </div>
  );
};

export const PranaStats: React.FC = () => {
  const {
    marketCapVnd,
    stakedPrana,
    stakedVnd,
    interestPrana,
    interestVnd,
    buyBondPrana,
    buyBondVnd,
    sellBondPrana,
    sellBondVnd,
    priceChange,
    isLoading
  } = usePranaStats();

  const performanceMetrics = useMemo(
    () => [
      { label: '1 Month', value: priceChange.m1 },
      { label: '3 Months', value: priceChange.m3 },
      { label: '6 Months', value: priceChange.m6 },
      { label: '1 Year', value: priceChange.y1 },
      { label: 'All Time', value: priceChange.atl },
    ],
    [priceChange]
  );

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 items-stretch">
            {/* Market Cap - Highlighted */}
            <StatCard
                title="Market Cap"
                mainValue={isLoading ? "Loading..." : `≈ ${formatCurrency(marketCapVnd, 'VND')} VNĐ`}
                subValue="Fully Diluted Valuation"
                icon={DollarSign}
                highlight={true}
                delay={0.1}
                loading={isLoading}
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

            {/* Interest Committed */}
            <StatCard
                title="Interest Committed"
                mainValue={isLoading ? "Loading..." : `${formatCurrency(interestPrana, 'PRANA')} PRANA`}
                subValue={`≈ ${formatCurrency(interestVnd, 'VND')} VNĐ`}
                icon={Activity}
                delay={0.3}
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
            />

            {/* Performance Card (Consolidated Percentage Changes) */}
            <div 
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-5 py-4 transition-all duration-500 hover:border-white/20 hover:bg-white/10 flex flex-col gap-4 lg:col-span-3"
                style={{ animation: `fadeInUp 0.6s ease-out 0.6s backwards` }}
            >
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        Performance
                    </h3>
                    <span className="text-xs text-gray-500 uppercase tracking-widest">Summary Strip</span>
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

