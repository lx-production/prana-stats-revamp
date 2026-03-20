import React from 'react';
import { Activity, Lock } from 'lucide-react';
import { useStakingAdditionalCapacity } from '../hooks/useStakingAdditionalCapacity';
import { useStakingRunway } from '../hooks/useStakingRunway';
import { useStakingStats } from '../hooks/useStakingStats';
import { formatCurrency } from '../utils/formatters';
import InfoTooltip from './InfoTooltip';
import StatCard from './StatCard';

const APR = 0.12;

export const StakingStats: React.FC = () => {
  const {
    stakedPrana,
    stakedVnd,
    interestContractBalancePrana,
    interestContractBalanceVnd,
    interestPrana,
    interestVnd,
    isLoading,
    error,
  } = useStakingStats();

  const { runwayDays } = useStakingRunway({
    interestBalancePrana: interestContractBalancePrana,
    totalStakedPrana: stakedPrana,
    apr: APR,
  });

  const { additionalStakeCapacityPrana } = useStakingAdditionalCapacity({
    interestBalancePrana: interestContractBalancePrana,
    interestCommittedPrana: interestPrana,
    apr: APR,
  });

  return (
    <>
      {error ? (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200 sm:col-span-2 lg:col-span-3">
          {error}
        </div>
      ) : null}

      <StatCard
        title="Total Value Staked"
        mainValue={isLoading ? 'Loading...' : `${formatCurrency(stakedPrana, 'PRANA')} PRANA`}
        subValue={`≈ ${formatCurrency(stakedVnd, 'VND')} VNĐ`}
        icon={Lock}
        delay={0.2}
        loading={isLoading}
      />

      <StatCard
        title="Staking Interest Balance"
        mainValue={isLoading ? 'Loading...' : `${formatCurrency(interestContractBalancePrana, 'PRANA')} PRANA`}
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
                  text="Runway là ước lượng đơn giản: Nếu mỗi ngày quỹ Interest Contract ‘mất’ một lượng PRANA bằng lãi ước tính (12% APR trên tổng đang stake, chia đều 365 ngày) và tổng stake không đổi, thì số dư hiện tại đủ khoảng bao nhiêu ngày. Stake và quỹ thay đổi thì con số thay đổi. Công thức: Runway = Interest Balance / (Total Staked * 0.12 / 365)"
                  widthClassName="w-[min(24rem,calc(100vw-2rem))]"
                />
              </div>
            </div>
          ) : null
        }
      />

      <StatCard
        title="Staking Interest Committed"
        mainValue={isLoading ? 'Loading...' : `${formatCurrency(interestPrana, 'PRANA')} PRANA`}
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
                  text="Capacity là ước tính lượng PRANA có thể được stake thêm mà phần quỹ PRANA còn lại trong Interest Contract vẫn đủ để trả lãi với giả định APR cố định 12%. Công thức: Capacity ≈ (Interest Balance − Interest Committed) / 0.12"
                />
              </div>
            </div>
          ) : null
        }
      />
    </>
  );
};

export default StakingStats;
