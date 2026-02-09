import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { BondingStatsProps, BondProgressBarProps } from '../types';
import { useBondProgress } from '../hooks/useBondProgress';
import StatCard from './StatCard';

const BondProgressBar: React.FC<BondProgressBarProps> = ({
  loading,
  committedValue,
  capacityValue,
  committedPercent,
  capacityPercent,
  unit
}) => {
  const { safeCommittedPercent, safeCapacityPercent } = useBondProgress({
    committedPercent,
    capacityPercent
  });

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

const BondingStats: React.FC<BondingStatsProps> = ({
  isLoading,
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
  sellBondCapacityPercent
}) => {
  return (
    <>
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
    </>
  );
};

export default BondingStats;
