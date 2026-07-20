import type { SiteLocale } from '../../types/locale.types.ts';
import type { StakeAmountParseReason } from './staking.types.ts';

type StakingCopy = {
  pageTitle: string;
  pageSubtitle: string;
  backHome: string;
  viewStats: string;
  connectWallet: string;
  disconnect: string;
  switchPolygon: string;
  connectedAs: string;
  stakeHeading: string;
  amountLabel: string;
  balanceLabel: string;
  maxButton: string;
  durationLabel: string;
  projectedInterestLabel: string;
  projectedInterestHint: string;
  pausedBanner: string;
  loadingConfig: string;
  configError: string;
  signPermit: string;
  stakeAction: string;
  txComingSoon: string;
  activeStakesHeading: string;
  noStakes: string;
  loadingStakes: string;
  accountError: string;
  stakeId: (id: number) => string;
  statusActive: string;
  statusMatured: string;
  aprLabel: (apr: number) => string;
  durationDays: (days: number) => string;
  started: string;
  ends: string;
  progressComplete: (percent: number) => string;
  accruedInterest: string;
  maturityInterest: string;
  actionsComingSoon: string;
  minStakeHint: (amount: string) => string;
  exceedsBalance: string;
  amountReasons: Record<StakeAmountParseReason, string>;
};

const vi: StakingCopy = {
  pageTitle: 'Staking',
  pageSubtitle:
    'Stake PRANA với APR cố định trên Polygon. Permit và gửi giao dịch sẽ được hoàn thiện ở bước tiếp theo.',
  backHome: 'Về trang chủ',
  viewStats: 'Xem thống kê protocol',
  connectWallet: 'Kết nối ví',
  disconnect: 'Ngắt kết nối',
  switchPolygon: 'Chuyển sang Polygon',
  connectedAs: 'Đã kết nối',
  stakeHeading: 'Stake PRANA',
  amountLabel: 'Số lượng',
  balanceLabel: 'Số dư',
  maxButton: 'MAX',
  durationLabel: 'Chọn kỳ hạn',
  projectedInterestLabel: 'Lãi dự kiến khi đáo hạn',
  projectedInterestHint: 'Tính theo công thức on-chain (làm tròn integer).',
  pausedBanner: 'Hợp đồng staking đang tạm dừng. Không thể mở stake mới.',
  loadingConfig: 'Đang tải cấu hình staking…',
  configError: 'Không tải được cấu hình staking. Thử lại sau.',
  signPermit: 'Ký Permit',
  stakeAction: 'Stake PRANA',
  txComingSoon: 'Luồng ký permit và gửi giao dịch sẽ có ở bước tiếp theo.',
  activeStakesHeading: 'Stake đang hoạt động',
  noStakes: 'Bạn chưa có stake nào.',
  loadingStakes: 'Đang tải stake…',
  accountError: 'Không tải được dữ liệu tài khoản. Thử lại sau.',
  stakeId: (id) => `Stake #${id}`,
  statusActive: 'Đang chạy',
  statusMatured: 'Đã đáo hạn',
  aprLabel: (apr) => `${apr}% APR`,
  durationDays: (days) => `${days} ngày`,
  started: 'Bắt đầu',
  ends: 'Kết thúc',
  progressComplete: (percent) => `${percent}% hoàn thành`,
  accruedInterest: 'Lãi đã tích lũy',
  maturityInterest: 'Lãi khi đáo hạn',
  actionsComingSoon: 'Claim / unstake sẽ có ở bước tiếp theo.',
  minStakeHint: (amount) => `Tối thiểu ${amount} PRANA`,
  exceedsBalance: 'Số lượng vượt quá số dư ví.',
  amountReasons: {
    empty: 'Nhập số lượng PRANA.',
    invalid: 'Số lượng không hợp lệ.',
    zero: 'Số lượng phải lớn hơn 0.',
    negative: 'Số lượng không được âm.',
    too_many_decimals: 'Tối đa 9 chữ số thập phân.',
  },
};

const en: StakingCopy = {
  pageTitle: 'Staking',
  pageSubtitle:
    'Stake PRANA at a fixed APR on Polygon. Permit signing and transactions land in the next step.',
  backHome: 'Back to home',
  viewStats: 'View protocol statistics',
  connectWallet: 'Connect wallet',
  disconnect: 'Disconnect',
  switchPolygon: 'Switch to Polygon',
  connectedAs: 'Connected',
  stakeHeading: 'Stake PRANA',
  amountLabel: 'Amount',
  balanceLabel: 'Balance',
  maxButton: 'MAX',
  durationLabel: 'Choose duration',
  projectedInterestLabel: 'Guaranteed interest at maturity',
  projectedInterestHint: 'Uses on-chain integer rounding order.',
  pausedBanner: 'Staking is paused. New stakes are disabled.',
  loadingConfig: 'Loading staking config…',
  configError: 'Could not load staking config. Try again later.',
  signPermit: 'Sign Permit',
  stakeAction: 'Stake PRANA',
  txComingSoon: 'Permit signing and stake submission land in the next step.',
  activeStakesHeading: 'My active stakes',
  noStakes: 'You do not have any active stakes yet.',
  loadingStakes: 'Loading stakes…',
  accountError: 'Could not load account data. Try again later.',
  stakeId: (id) => `Stake #${id}`,
  statusActive: 'Active',
  statusMatured: 'Matured',
  aprLabel: (apr) => `${apr}% APR`,
  durationDays: (days) => `${days} days`,
  started: 'Started',
  ends: 'Ends',
  progressComplete: (percent) => `${percent}% complete`,
  accruedInterest: 'Accrued interest',
  maturityInterest: 'Interest at maturity',
  actionsComingSoon: 'Claim / unstake actions land in the next step.',
  minStakeHint: (amount) => `Min ${amount} PRANA`,
  exceedsBalance: 'Amount exceeds wallet balance.',
  amountReasons: {
    empty: 'Enter a PRANA amount.',
    invalid: 'Invalid amount.',
    zero: 'Amount must be greater than zero.',
    negative: 'Amount cannot be negative.',
    too_many_decimals: 'At most 9 decimal places.',
  },
};

export function getStakingCopy(locale: SiteLocale): StakingCopy {
  return locale === 'en' ? en : vi;
}
