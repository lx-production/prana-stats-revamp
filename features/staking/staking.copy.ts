import type { SiteLocale } from '../../types/locale.types.ts';
import type { StakeAmountParseReason, StakeDisplayStatus } from './staking.types.ts';

export type StakingCopy = {
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
  stakesConfigPending: string;
  stakesConfigError: string;
  stakesPausedBanner: string;
  loadingConfig: string;
  configError: string;
  signPermit: string;
  permitSigned: string;
  signingPermit: string;
  stakeAction: string;
  stakingSubmitting: string;
  stakingConfirming: string;
  activeStakesHeading: string;
  noStakes: string;
  loadingStakes: string;
  accountError: string;
  stakeId: (id: number) => string;
  statusLabel: Record<StakeDisplayStatus, string>;
  aprLabel: (apr: number) => string;
  durationDays: (days: number) => string;
  started: string;
  ends: string;
  progressComplete: (percent: number) => string;
  accruedInterest: string;
  maturityInterest: string;
  claimInterest: string;
  unstake: string;
  unstakeEarly: (penaltyPercent: number) => string;
  claimFirstHint: string;
  graceExpiredWarning: string;
  processing: string;
  viewOnPolygonscan: string;
  minStakeHint: (amount: string) => string;
  exceedsBalance: string;
  amountReasons: Record<StakeAmountParseReason, string>;
  earlyDialogTitle: string;
  earlyDialogBody: (penaltyPercent: number) => string;
  earlyDialogPenalty: string;
  earlyDialogReturn: string;
  earlyDialogInterestLost: string;
  earlyDialogConfirm: string;
  earlyDialogCancel: string;
  switchPolygonFirst: string;
  stakingContractLink: string;
  interestContractLink: string;
};

const vi: StakingCopy = {
  pageTitle: 'Staking',
  pageSubtitle:
    'Stake PRANA với APR cố định trên Polygon. Ký permit rồi gửi giao dịch stake.',
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
  stakesConfigPending: 'Đang tải cấu hình — tạm khóa claim/unstake để tránh mất lãi.',
  stakesConfigError: 'Không tải được cấu hình — tạm khóa claim/unstake.',
  stakesPausedBanner: 'Hợp đồng đang tạm dừng. Claim/unstake hiện không khả dụng.',
  loadingConfig: 'Đang tải cấu hình staking…',
  configError: 'Không tải được cấu hình staking. Thử lại sau.',
  signPermit: 'Ký Permit',
  permitSigned: 'Permit đã ký ✓',
  signingPermit: 'Đang ký…',
  stakeAction: 'Stake PRANA',
  stakingSubmitting: 'Đang gửi…',
  stakingConfirming: 'Đang xác nhận…',
  activeStakesHeading: 'Stake đang hoạt động',
  noStakes: 'Bạn chưa có stake nào.',
  loadingStakes: 'Đang tải stake…',
  accountError: 'Không tải được dữ liệu tài khoản. Thử lại sau.',
  stakeId: (id) => `Stake #${id}`,
  statusLabel: {
    active: 'Đang chạy',
    matured: 'Đã đáo hạn',
    claim_first: 'Claim trước',
    grace_expired: 'Hết grace',
  },
  aprLabel: (apr) => `${apr}% APR`,
  durationDays: (days) => `${days} ngày`,
  started: 'Bắt đầu',
  ends: 'Kết thúc',
  progressComplete: (percent) => `${percent}% hoàn thành`,
  accruedInterest: 'Lãi chưa claim',
  maturityInterest: 'Lãi khi đáo hạn',
  claimInterest: 'Claim lãi',
  unstake: 'Unstake',
  unstakeEarly: (penaltyPercent) => `Unstake sớm (−${penaltyPercent}%)`,
  claimFirstHint: 'Hãy claim lãi trước khi unstake để không mất lãi.',
  graceExpiredWarning:
    'Đã hết grace period — lãi chưa claim không thể nhận nữa.',
  processing: 'Đang xử lý…',
  viewOnPolygonscan: 'Xem trên Polygonscan',
  minStakeHint: (amount) => `Tối thiểu ${amount} PRANA`,
  exceedsBalance: 'Số lượng vượt quá số dư ví.',
  amountReasons: {
    empty: 'Nhập số lượng PRANA.',
    invalid: 'Số lượng không hợp lệ.',
    zero: 'Số lượng phải lớn hơn 0.',
    negative: 'Số lượng không được âm.',
    too_many_decimals: 'Tối đa 9 chữ số thập phân.',
  },
  earlyDialogTitle: 'Unstake sớm?',
  earlyDialogBody: (penaltyPercent) =>
    `Unstake sớm sẽ bị trừ ${penaltyPercent}% vốn gốc theo hợp đồng.`,
  earlyDialogPenalty: 'Phạt',
  earlyDialogReturn: 'Nhận lại ước tính',
  earlyDialogInterestLost:
    'Toàn bộ lãi đã tích lũy sẽ bị mất (không claim được).',
  earlyDialogConfirm: 'Xác nhận unstake sớm',
  earlyDialogCancel: 'Hủy',
  switchPolygonFirst: 'Hãy chuyển sang Polygon trước.',
  stakingContractLink: 'Hợp đồng Staking',
  interestContractLink: 'Hợp đồng Interest',
};

const en: StakingCopy = {
  pageTitle: 'Staking',
  pageSubtitle:
    'Stake PRANA at a fixed APR on Polygon. Sign a permit, then submit the stake transaction.',
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
  stakesConfigPending:
    'Loading config — claim/unstake locked to avoid losing interest.',
  stakesConfigError: 'Could not load config — claim/unstake locked.',
  stakesPausedBanner: 'Staking is paused. Claim/unstake are unavailable.',
  loadingConfig: 'Loading staking config…',
  configError: 'Could not load staking config. Try again later.',
  signPermit: 'Sign Permit',
  permitSigned: 'Permit signed ✓',
  signingPermit: 'Signing…',
  stakeAction: 'Stake PRANA',
  stakingSubmitting: 'Submitting…',
  stakingConfirming: 'Confirming…',
  activeStakesHeading: 'My active stakes',
  noStakes: 'You do not have any active stakes yet.',
  loadingStakes: 'Loading stakes…',
  accountError: 'Could not load account data. Try again later.',
  stakeId: (id) => `Stake #${id}`,
  statusLabel: {
    active: 'Active',
    matured: 'Matured',
    claim_first: 'Claim first',
    grace_expired: 'Grace expired',
  },
  aprLabel: (apr) => `${apr}% APR`,
  durationDays: (days) => `${days} days`,
  started: 'Started',
  ends: 'Ends',
  progressComplete: (percent) => `${percent}% complete`,
  accruedInterest: 'Unclaimed interest',
  maturityInterest: 'Interest at maturity',
  claimInterest: 'Claim interest',
  unstake: 'Unstake',
  unstakeEarly: (penaltyPercent) => `Unstake early (−${penaltyPercent}%)`,
  claimFirstHint: 'Claim interest before unstaking so you do not lose it.',
  graceExpiredWarning:
    'Grace period ended — unclaimed interest can no longer be claimed.',
  processing: 'Processing…',
  viewOnPolygonscan: 'View on Polygonscan',
  minStakeHint: (amount) => `Min ${amount} PRANA`,
  exceedsBalance: 'Amount exceeds wallet balance.',
  amountReasons: {
    empty: 'Enter a PRANA amount.',
    invalid: 'Invalid amount.',
    zero: 'Amount must be greater than zero.',
    negative: 'Amount cannot be negative.',
    too_many_decimals: 'At most 9 decimal places.',
  },
  earlyDialogTitle: 'Unstake early?',
  earlyDialogBody: (penaltyPercent) =>
    `Early unstaking applies a ${penaltyPercent}% principal penalty from the contract.`,
  earlyDialogPenalty: 'Penalty',
  earlyDialogReturn: 'Estimated return',
  earlyDialogInterestLost:
    'All accrued interest will be lost (it cannot be claimed).',
  earlyDialogConfirm: 'Confirm early unstake',
  earlyDialogCancel: 'Cancel',
  switchPolygonFirst: 'Switch to Polygon first.',
  stakingContractLink: 'Staking contract',
  interestContractLink: 'Interest contract',
};

export function getStakingCopy(locale: SiteLocale): StakingCopy {
  return locale === 'en' ? en : vi;
}
