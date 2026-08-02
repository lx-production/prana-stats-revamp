import type { SiteLocale } from '../../../types/locale.types.ts';

/** Stable error codes — UI maps these to VI/EN copy, never raw provider text. */
export type BondingErrorCode =
  | 'not_connected'
  | 'wrong_chain'
  | 'paused'
  | 'invalid_amount'
  | 'invalid_term'
  | 'below_min'
  | 'insufficient_balance'
  | 'insufficient_gas'
  | 'insufficient_allowance'
  | 'insufficient_treasury'
  | 'exceeds_reserve'
  | 'user_rejected'
  | 'reverted'
  | 'rpc_unavailable'
  | 'account_refetch_failed'
  | 'quote_issues'
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
export function classifyBondingError(error: unknown): BondingErrorCode {
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
    combined.includes('not connected') ||
    combined.includes('no connector') ||
    combined.includes('connector not found')
  ) {
    return 'not_connected';
  }

  // Wallet/provider "insufficient funds" errors refer to native gas (POL).
  if (combined.includes('insufficient funds')) {
    return 'insufficient_gas';
  }

  if (
    combined.includes('insufficient allowance') ||
    combined.includes('transfer amount exceeds allowance') ||
    combined.includes('erc20: insufficient allowance')
  ) {
    return 'insufficient_allowance';
  }

  if (
    combined.includes('insufficient balance') ||
    combined.includes('exceeds balance') ||
    combined.includes('transfer amount exceeds balance')
  ) {
    return 'insufficient_balance';
  }

  if (
    combined.includes('paused') ||
    combined.includes('enforcedpause') ||
    combined.includes('contract is paused')
  ) {
    return 'paused';
  }

  if (
    combined.includes('treasury') ||
    combined.includes('insufficient treasury')
  ) {
    return 'insufficient_treasury';
  }

  if (combined.includes('reserve') || combined.includes('exceeds reserve')) {
    return 'exceeds_reserve';
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

const ERROR_COPY: Record<SiteLocale, Record<BondingErrorCode, string>> = {
  vi: {
    not_connected: 'Hãy kết nối ví trước.',
    wrong_chain: 'Hãy chuyển ví sang Polygon Mainnet (chainId 137).',
    paused: 'Contract bonding đang tạm dừng.',
    invalid_amount: 'Số lượng không hợp lệ.',
    invalid_term: 'Kỳ hạn đã chọn không còn khả dụng. Hãy chọn lại.',
    below_min: 'Số lượng thấp hơn mức tối thiểu.',
    insufficient_balance: 'Số dư token không đủ.',
    insufficient_gas: 'Số dư POL không đủ để trả phí gas.',
    insufficient_allowance: 'Allowance không đủ. Hãy approve lại.',
    insufficient_treasury: 'Treasury không đủ cho giao dịch này.',
    exceeds_reserve: 'Vượt reserve hiện có.',
    user_rejected: 'Bạn đã từ chối yêu cầu trên ví.',
    reverted: 'Giao dịch bị revert trên chain.',
    rpc_unavailable: 'Không kết nối được RPC. Thử lại sau.',
    account_refetch_failed:
      'Không tải được số dư/allowance mới nhất. Thử lại trước khi ký.',
    quote_issues: 'Quote hiện không thể thực thi. Kiểm tra lại số lượng.',
    generic: 'Không thể hoàn tất giao dịch. Thử lại.',
  },
  en: {
    not_connected: 'Connect your wallet first.',
    wrong_chain: 'Switch your wallet to Polygon Mainnet (chainId 137).',
    paused: 'Bonding is currently paused.',
    invalid_amount: 'Enter a valid amount.',
    invalid_term: 'The selected term is no longer available. Choose again.',
    below_min: 'Amount is below the minimum.',
    insufficient_balance: 'Insufficient token balance.',
    insufficient_gas: 'Insufficient POL balance for gas.',
    insufficient_allowance: 'Allowance is too low. Approve again.',
    insufficient_treasury: 'Treasury cannot cover this bond.',
    exceeds_reserve: 'Exceeds available reserve.',
    user_rejected: 'You rejected the wallet request.',
    reverted: 'Transaction reverted on-chain.',
    rpc_unavailable: 'RPC unavailable. Try again later.',
    account_refetch_failed:
      'Could not refresh balance/allowance. Try again before signing.',
    quote_issues: 'Quote is not executable. Check the amount and try again.',
    generic: 'Could not complete the transaction. Try again.',
  },
};

export function getBondingErrorMessage(
  code: BondingErrorCode,
  locale: SiteLocale,
): string {
  return ERROR_COPY[locale][code];
}

/**
 * Dev breadcrumb for bonding write failures.
 * UI still shows locale copy only — raw provider text stays in the console.
 */
export function logBondingFailure(context: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.error(`[bonding] ${context}`, detail);
    return;
  }
  console.error(`[bonding] ${context}`);
}

export function formatBondingError(
  error: unknown,
  locale: SiteLocale,
): string {
  const code = classifyBondingError(error);
  logBondingFailure(code, error);
  return getBondingErrorMessage(code, locale);
}
