import React from 'react';
import { DollarSign } from 'lucide-react';
import type { BasicStatsProps } from '../types/basicStats';
import { formatCurrency, formatNumber } from '../utils/formatters';
import StatCard from './StatCard';

const BasicStats: React.FC<BasicStatsProps> = ({
  marketCapVnd,
  latestSatPrice,
  pranaPriceUsd,
  isLoading = false,
}) => {
  return (
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
  );
};

export default BasicStats;
