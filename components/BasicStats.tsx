import React from 'react';
import StatCard from './StatCard';
import { DollarSign } from 'lucide-react';
import { useBasicStats } from '../hooks/useBasicStats';
import { formatCurrency, formatNumber } from '../utils/formatters';

const BasicStats: React.FC = () => {
  const { error, basicStatsProps } = useBasicStats();
  const {
    marketCapVnd,
    latestSatPrice,
    pranaPriceUsd,
    isLoading = false,
  } = basicStatsProps;

  return (
    <>
      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200 sm:col-span-2 lg:col-span-3">
          {error}
        </div>
      ) : null}

      <StatCard
        title="Market Cap"
        mainValue={
          isLoading ? (
            'Loading...'
          ) : (
            <div className="flex flex-col gap-1">
              <span>{`${formatCurrency(marketCapVnd, 'VND')} VNĐ`}</span>
              <span className="mt-4 text-base font-medium text-white sm:text-base">
                {`1 PRANA ≈ ${formatNumber(latestSatPrice ?? 0, 2)} SAT ≈ ${formatNumber(pranaPriceUsd, 4)} USD`}
              </span>
            </div>
          )
        }
        icon={DollarSign}
        highlight={true}
        delay={0.1}
        loading={isLoading}
        footer={
          <div className="text-xs uppercase tracking-wider text-gray-500">
            Fully Diluted Valuation
          </div>
        }
      />
    </>
  );
};

export default BasicStats;
