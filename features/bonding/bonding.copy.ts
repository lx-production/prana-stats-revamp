import type { SiteLocale } from '../../types/locale.types.ts';
import type {
  BondAmountParseReason,
  BondingQuoteIssue,
  BondSide,
  BondVersion,
} from './bonding.types.ts';

export type BondingCopy = {
  pageTitle: string;
  pageSubtitle: string;
  backHome: string;
  connectWallet: string;
  disconnect: string;
  switchPolygon: string;
  connectedAs: string;
  buyTab: string;
  sellTab: string;
  buyExactWbtcMode: string;
  buyTargetPranaMode: string;
  amountLabelWbtc: string;
  amountLabelPrana: string;
  balanceLabel: string;
  maxButton: string;
  termLabel: string;
  loadingConfig: string;
  configError: string;
  pausedBuyBanner: string;
  pausedSellBanner: string;
  quoteLoading: string;
  quoteError: string;
  quoteStale: string;
  quoteEmpty: string;
  expectedPrana: string;
  expectedWbtc: string;
  requiredWbtc: string;
  targetPranaNoMaxInWarning: string;
  reserveSourceImpacted: string;
  reserveSourceMarket: string;
  rateLabel: string;
  durationLabel: (days: number) => string;
  /** Primary CTA phases (Approve → Review → Create → Confirming). */
  approveCta: string;
  approvingCta: string;
  reviewQuote: string;
  refreshingQuote: string;
  createBondCta: string;
  creatingBondCta: string;
  confirmingCta: string;
  resumeConfirmingCta: string;
  bondSuccessCta: string;
  quoteReady: string;
  bondConfirmed: string;
  accountSyncWarning: string;
  confirmationUnavailable: string;
  reviewDialogTitle: string;
  reviewDialogBody: string;
  reviewDialogWbtcCap: string;
  reviewDialogConfirm: string;
  reviewDialogCancel: string;
  processing: string;
  activeBondsHeading: string;
  noBonds: string;
  loadingBonds: string;
  accountError: string;
  bondId: (id: string) => string;
  sideBadge: Record<BondSide, string>;
  versionBadge: Record<BondVersion, string>;
  principalLabel: string;
  payoutLabel: string;
  claimedLabel: string;
  claimableLabel: string;
  maturityLabel: string;
  progressComplete: (percent: number) => string;
  ratePercent: (percentLabel: string) => string;
  minBuyHint: (amount: string) => string;
  minSellHint: (amount: string) => string;
  exceedsBalance: string;
  amountReasons: Record<BondAmountParseReason, string>;
  quoteIssues: Record<BondingQuoteIssue, string>;
  switchPolygonFirst: string;
  buyV1ContractLink: string;
  buyV2ContractLink: string;
  sellV1ContractLink: string;
  sellV2ContractLink: string;
  contractsGuideLink: string;
};

const vi: BondingCopy = {
  pageTitle: 'Bonding',
  pageSubtitle:
    'Mua hoặc bán bond PRANA trên Polygon. Quote đi qua backend; ví chỉ ký approve, tạo bond và claim.',
  backHome: 'Trang chủ',
  connectWallet: 'Kết nối ví',
  disconnect: 'Ngắt kết nối',
  switchPolygon: 'Chuyển sang Polygon',
  connectedAs: 'Đã kết nối',
  buyTab: 'Mua Bond',
  sellTab: 'Bán Bond',
  buyExactWbtcMode: 'WBTC chính xác',
  buyTargetPranaMode: 'Target PRANA',
  amountLabelWbtc: 'Số lượng WBTC',
  amountLabelPrana: 'Số lượng PRANA',
  balanceLabel: 'Số dư',
  maxButton: 'MAX',
  termLabel: 'Chọn kỳ hạn',
  loadingConfig: 'Đang tải cấu hình bonding…',
  configError: 'Không tải được cấu hình bonding. Thử lại sau.',
  pausedBuyBanner: 'Buy Bond V2 đang tạm dừng. Không thể mở bond mua mới.',
  pausedSellBanner: 'Sell Bond V2 đang tạm dừng. Không thể mở bond bán mới.',
  quoteLoading: 'Đang lấy quote…',
  quoteError: 'Không lấy được quote. Thử lại sau.',
  quoteStale: 'Quote đã cũ hơn 30 giây — sẽ làm mới trước khi tiếp tục.',
  quoteEmpty: 'Nhập số lượng hợp lệ để xem quote.',
  expectedPrana: 'PRANA nhận dự kiến',
  expectedWbtc: 'WBTC nhận dự kiến',
  requiredWbtc: 'WBTC cần trả dự kiến',
  targetPranaNoMaxInWarning:
    'Contract không nhận tham số “WBTC tối đa được phép chi”. Allowance WBTC hoạt động như spending cap thay thế.',
  reserveSourceImpacted: 'Nguồn reserve: impacted',
  reserveSourceMarket: 'Nguồn reserve: market',
  rateLabel: 'Tỷ lệ chiết khấu',
  durationLabel: (days) => `${days} ngày`,
  approveCta: 'Approve',
  approvingCta: 'Đang approve…',
  reviewQuote: 'Xem lại',
  refreshingQuote: 'Đang làm mới quote…',
  createBondCta: 'Tạo Bond',
  creatingBondCta: 'Đang tạo bond…',
  confirmingCta: 'Đang xác nhận…',
  resumeConfirmingCta: 'Tiếp tục xác nhận',
  bondSuccessCta: 'Đã tạo bond',
  quoteReady: 'Quote sẵn sàng',
  bondConfirmed: 'Giao dịch bonding đã xác nhận trên Polygon.',
  accountSyncWarning:
    'Giao dịch thành công nhưng chưa tải lại số dư. Làm mới trang nếu cần.',
  confirmationUnavailable:
    'Đã gửi giao dịch nhưng chưa xác nhận được receipt. Kiểm tra Polygonscan rồi bấm Tiếp tục xác nhận.',
  reviewDialogTitle: 'Xác nhận tạo bond',
  reviewDialogBody:
    'Kiểm tra lại số lượng và kỳ hạn trước khi ví mở giao dịch tạo bond.',
  reviewDialogWbtcCap: 'Cap WBTC (allowance)',
  reviewDialogConfirm: 'Tạo Bond',
  reviewDialogCancel: 'Hủy',
  processing: 'Đang xử lý…',
  activeBondsHeading: 'Bond đang hoạt động',
  noBonds: 'Chưa có bond nào.',
  loadingBonds: 'Đang tải danh sách bond…',
  accountError: 'Không tải được dữ liệu ví. Thử lại sau.',
  bondId: (id) => `Bond #${id}`,
  sideBadge: { buy: 'Mua', sell: 'Bán' },
  versionBadge: { v1: 'V1', v2: 'V2' },
  principalLabel: 'Gốc',
  payoutLabel: 'Payout',
  claimedLabel: 'Đã claim',
  claimableLabel: 'Có thể claim',
  maturityLabel: 'Đáo hạn',
  progressComplete: (percent) => `${percent}% đã vest`,
  ratePercent: (percentLabel) => `${percentLabel}`,
  minBuyHint: (amount) => `Tối thiểu ${amount} PRANA`,
  minSellHint: (amount) => `Tối thiểu ${amount} PRANA`,
  exceedsBalance: 'Vượt quá số dư ví.',
  amountReasons: {
    empty: 'Nhập số lượng.',
    invalid: 'Số lượng không hợp lệ.',
    zero: 'Số lượng phải lớn hơn 0.',
    negative: 'Số lượng không được âm.',
    too_many_decimals: 'Quá nhiều chữ số thập phân.',
  },
  quoteIssues: {
    paused: 'Contract đang tạm dừng.',
    below_minimum: 'Dưới mức tối thiểu.',
    exceeds_reserve: 'Vượt reserve hiện có.',
    insufficient_treasury: 'Treasury không đủ.',
    invalid_term: 'Kỳ hạn không hợp lệ.',
    zero_amount: 'Số lượng bằng 0.',
  },
  switchPolygonFirst: 'Chuyển sang Polygon trước.',
  buyV1ContractLink: 'Buy Bond V1',
  buyV2ContractLink: 'Buy Bond V2',
  sellV1ContractLink: 'Sell Bond V1',
  sellV2ContractLink: 'Sell Bond V2',
  contractsGuideLink: 'Hướng dẫn contracts',
};

const en: BondingCopy = {
  pageTitle: 'Bonding',
  pageSubtitle:
    'Buy or sell PRANA bonds on Polygon. Quotes go through the backend; the wallet only signs approve, create, and claim.',
  backHome: 'Home',
  connectWallet: 'Connect wallet',
  disconnect: 'Disconnect',
  switchPolygon: 'Switch to Polygon',
  connectedAs: 'Connected as',
  buyTab: 'Buy Bond',
  sellTab: 'Sell Bond',
  buyExactWbtcMode: 'Exact WBTC',
  buyTargetPranaMode: 'Target PRANA',
  amountLabelWbtc: 'WBTC amount',
  amountLabelPrana: 'PRANA amount',
  balanceLabel: 'Balance',
  maxButton: 'MAX',
  termLabel: 'Choose term',
  loadingConfig: 'Loading bonding config…',
  configError: 'Could not load bonding config. Try again later.',
  pausedBuyBanner: 'Buy Bond V2 is paused. New buy bonds cannot be opened.',
  pausedSellBanner: 'Sell Bond V2 is paused. New sell bonds cannot be opened.',
  quoteLoading: 'Fetching quote…',
  quoteError: 'Could not fetch quote. Try again later.',
  quoteStale: 'Quote is older than 30 seconds — it will refresh before continuing.',
  quoteEmpty: 'Enter a valid amount to see a quote.',
  expectedPrana: 'Expected PRANA',
  expectedWbtc: 'Expected WBTC',
  requiredWbtc: 'Estimated WBTC required',
  targetPranaNoMaxInWarning:
    'The contract does not accept a “maximum WBTC allowed” parameter. WBTC allowance acts as a spending cap instead.',
  reserveSourceImpacted: 'Reserve source: impacted',
  reserveSourceMarket: 'Reserve source: market',
  rateLabel: 'Discount rate',
  durationLabel: (days) => `${days} days`,
  approveCta: 'Approve',
  approvingCta: 'Approving…',
  reviewQuote: 'Review',
  refreshingQuote: 'Refreshing quote…',
  createBondCta: 'Create Bond',
  creatingBondCta: 'Creating bond…',
  confirmingCta: 'Confirming…',
  resumeConfirmingCta: 'Continue confirming',
  bondSuccessCta: 'Bond created',
  quoteReady: 'Quote ready',
  bondConfirmed: 'Bonding transaction confirmed on Polygon.',
  accountSyncWarning:
    'Transaction succeeded but the balance refresh failed. Reload if needed.',
  confirmationUnavailable:
    'Transaction submitted but the receipt could not be confirmed. Check Polygonscan, then continue confirming.',
  reviewDialogTitle: 'Confirm create bond',
  reviewDialogBody:
    'Review amounts and term before your wallet opens the create-bond transaction.',
  reviewDialogWbtcCap: 'WBTC spending cap (allowance)',
  reviewDialogConfirm: 'Create Bond',
  reviewDialogCancel: 'Cancel',
  processing: 'Processing…',
  activeBondsHeading: 'Active bonds',
  noBonds: 'No active bonds yet.',
  loadingBonds: 'Loading bonds…',
  accountError: 'Could not load wallet data. Try again later.',
  bondId: (id) => `Bond #${id}`,
  sideBadge: { buy: 'Buy', sell: 'Sell' },
  versionBadge: { v1: 'V1', v2: 'V2' },
  principalLabel: 'Principal',
  payoutLabel: 'Payout',
  claimedLabel: 'Claimed',
  claimableLabel: 'Claimable',
  maturityLabel: 'Maturity',
  progressComplete: (percent) => `${percent}% vested`,
  ratePercent: (percentLabel) => `${percentLabel}`,
  minBuyHint: (amount) => `Minimum ${amount} PRANA`,
  minSellHint: (amount) => `Minimum ${amount} PRANA`,
  exceedsBalance: 'Exceeds wallet balance.',
  amountReasons: {
    empty: 'Enter an amount.',
    invalid: 'Invalid amount.',
    zero: 'Amount must be greater than zero.',
    negative: 'Amount cannot be negative.',
    too_many_decimals: 'Too many decimal places.',
  },
  quoteIssues: {
    paused: 'Contract is paused.',
    below_minimum: 'Below the minimum amount.',
    exceeds_reserve: 'Exceeds available reserve.',
    insufficient_treasury: 'Insufficient treasury.',
    invalid_term: 'Invalid term.',
    zero_amount: 'Amount is zero.',
  },
  switchPolygonFirst: 'Switch to Polygon first.',
  buyV1ContractLink: 'Buy Bond V1',
  buyV2ContractLink: 'Buy Bond V2',
  sellV1ContractLink: 'Sell Bond V1',
  sellV2ContractLink: 'Sell Bond V2',
  contractsGuideLink: 'Contracts guide',
};

export function getBondingCopy(locale: SiteLocale): BondingCopy {
  return locale === 'en' ? en : vi;
}
