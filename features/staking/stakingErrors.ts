import type { SiteLocale } from '../../types/locale.types.ts';

/** Stable error codes — UI maps these to VI/EN copy, never raw provider text. */
export type StakingErrorCode =
  | 'not_connected'
  | 'wrong_chain'
  | 'paused'
  | 'invalid_amount'
  | 'below_min'
  | 'insufficient_balance'
  | 'expired_permit'
  | 'invalid_permit'
  | 'user_rejected'
  | 'reverted'
  | 'rpc_unavailable'
  | 'account_refetch_failed'
  | 'generic';

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'shortMessage' in error) {
    const short = (error as { shortMessage?: unknown }).shortMessage;
    if (typeof short === 'string') return short;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

function nameOf(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return '';
}

/** Map wallet / viem / RPC failures to a stable UI error code. */
export function classifyStakingError(error: unknown): StakingErrorCode {
  const message = messageOf(error).toLowerCase();
  const name = nameOf(error).toLowerCase();
  const combined = `${name} ${message}`;

  if (
    combined.includes('user rejected') ||
    combined.includes('user denied') ||
    combined.includes('rejected the request') ||
    combined.includes('denied transaction') ||
    combined.includes('request rejected') ||
    combined.includes('user cancelled') ||
    combined.includes('user canceled')
  ) {
    return 'user_rejected';
  }

  if (
    combined.includes('chain mismatch') ||
    combined.includes('wrong chain') ||
    combined.includes('active chain') ||
    combined.includes('chainid') ||
    combined.includes('switch chain') ||
    combined.includes('unrecognized chain')
  ) {
    return 'wrong_chain';
  }

  if (
    combined.includes('insufficient funds') ||
    combined.includes('insufficient balance') ||
    combined.includes('exceeds balance')
  ) {
    return 'insufficient_balance';
  }

  if (combined.includes('permit') && combined.includes('expired')) {
    return 'expired_permit';
  }

  if (
    combined.includes('execution reverted') ||
    combined.includes('transaction reverted') ||
    combined.includes('reverted')
  ) {
    return 'reverted';
  }

  if (
    combined.includes('failed to fetch') ||
    combined.includes('network error') ||
    combined.includes('rpc') ||
    combined.includes('http request failed') ||
    combined.includes('timeout') ||
    combined.includes('econnrefused')
  ) {
    return 'rpc_unavailable';
  }

  return 'generic';
}

const ERROR_COPY: Record<SiteLocale, Record<StakingErrorCode, string>> = {
  vi: {
    not_connected: 'Hãy kết nối ví trước.',
    wrong_chain: 'Hãy chuyển ví sang Polygon Mainnet (chainId 137).',
    paused: 'Hợp đồng staking đang tạm dừng.',
    invalid_amount: 'Số lượng không hợp lệ.',
    below_min: 'Số lượng thấp hơn mức stake tối thiểu.',
    insufficient_balance: 'Số dư PRANA không đủ.',
    expired_permit: 'Permit đã hết hạn. Hãy ký lại.',
    invalid_permit: 'Permit không còn hợp lệ. Hãy ký lại.',
    user_rejected: 'Bạn đã từ chối yêu cầu trên ví.',
    reverted: 'Giao dịch bị revert trên chain.',
    rpc_unavailable: 'Không kết nối được RPC. Thử lại sau.',
    account_refetch_failed:
      'Không tải được số dư/nonce mới nhất. Thử lại trước khi ký.',
    generic: 'Không thể hoàn tất giao dịch. Thử lại.',
  },
  en: {
    not_connected: 'Connect your wallet first.',
    wrong_chain: 'Switch your wallet to Polygon Mainnet (chainId 137).',
    paused: 'Staking is currently paused.',
    invalid_amount: 'Enter a valid amount.',
    below_min: 'Amount is below the minimum stake.',
    insufficient_balance: 'Insufficient PRANA balance.',
    expired_permit: 'Permit expired. Sign again.',
    invalid_permit: 'Permit is no longer valid. Sign again.',
    user_rejected: 'You rejected the wallet request.',
    reverted: 'Transaction reverted on-chain.',
    rpc_unavailable: 'RPC unavailable. Try again later.',
    account_refetch_failed:
      'Could not refresh balance/nonce. Try again before signing.',
    generic: 'Could not complete the transaction. Try again.',
  },
};

export function getStakingErrorMessage(
  code: StakingErrorCode,
  locale: SiteLocale,
): string {
  return ERROR_COPY[locale][code];
}

export function formatStakingError(error: unknown, locale: SiteLocale): string {
  return getStakingErrorMessage(classifyStakingError(error), locale);
}
