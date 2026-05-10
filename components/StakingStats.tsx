import React from 'react';
import { Activity, Lock } from 'lucide-react';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import { useStakingAdditionalCapacity } from '../hooks/useStakingAdditionalCapacity';
import { useStakingStats } from '../hooks/useStakingStats';
import { formatCurrency } from '../utils/formatters';
import InfoTooltip from './InfoTooltip';
import StatCard from './StatCard';

const APR = 0.15;

export const StakingStats: React.FC = () => {
  const { locale } = useSiteLanguage();
  const {
    stakedPrana,
    stakedVnd,
    interestContractBalancePrana,
    interestContractBalanceVnd,
    interestPrana,
    interestVnd,
    runwayDays,
    isLoading,
    error,
  } = useStakingStats();

  const { additionalStakeCapacityPrana } = useStakingAdditionalCapacity({
    interestBalancePrana: interestContractBalancePrana,
    interestCommittedPrana: interestPrana,
    apr: APR,
  });

  const runwayTooltipAria =
    locale === 'en' ? 'Runway explanation' : 'Giải thích Runway';
  const runwayTooltipText =
    locale === 'en'
      ? "Runway estimates, after subtracting interest users can already claim, roughly how many days the Interest Contract balance would last if each day the fund still had to pay out an amount equal to interest accruing on all stakes that have not yet matured. Daily interest is computed from those stakes, using each stake’s own APR stored in the staking contract. Matured stakes that are still within the grace period and still have claimable interest are included in the amount subtracted first. Formula: Runway ≈ (Interest Contract balance − Claimable interest now) / Estimated interest accruing per day."
      : "Runway ước tính sau khi trừ phần lãi user đã có thể claim ngay, số dư Interest Contract còn đủ khoảng bao nhiêu ngày nếu mỗi ngày quỹ vẫn phải chi một lượng tương đương lãi đang tích lũy trên các stake chưa đáo hạn. Lãi mỗi ngày được tính từ các stake đó, dùng APR riêng của từng stake trong staking contract. Stake đã đáo hạn nhưng còn trong grace period và vẫn còn lãi claim được được tính vào phần trừ trước. Công thức: Runway ≈ (Số dư Interest Contract − Lãi có thể claim ngay) / Ước lượng lãi tích lũy mỗi ngày.";

  const capacityTooltipAria =
    locale === 'en' ? 'Capacity explanation' : 'Giải thích Capacity';
  const capacityTooltipText =
    locale === 'en'
      ? 'Capacity estimates how much more PRANA can be staked while the PRANA left in the Interest Contract is still enough to pay rewards, assuming a fixed 15% APR. Formula: Capacity ≈ (Interest Balance − Interest Committed) / 0.15.'
      : 'Capacity là ước tính lượng PRANA có thể được stake thêm mà phần quỹ PRANA còn lại trong Interest Contract vẫn đủ để trả lãi với giả định APR cố định 15%. Công thức: Capacity ≈ (Interest Balance − Interest Committed) / 0.15';

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
          runwayDays !== null && Number.isFinite(runwayDays) ? (
            <div className="text-sm text-gray-400 font-mono flex flex-col gap-1.5 relative w-full">
              <div className="flex items-center gap-2">
                <span>
                  Runway: {Math.round(runwayDays).toLocaleString()}{' '}
                  {locale === 'en' ? 'days' : 'ngày'}
                </span>
                <InfoTooltip
                  ariaLabel={runwayTooltipAria}
                  text={runwayTooltipText}
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
                  ariaLabel={capacityTooltipAria}
                  widthClassName="w-[min(24rem,calc(100vw-2rem))]"
                  text={capacityTooltipText}
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
