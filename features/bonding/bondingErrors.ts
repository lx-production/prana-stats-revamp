import type { SiteLocale } from '../../types/locale.types.ts';

/** Stable error codes — UI maps these to VI/EN copy, never raw provider text. */
export type BondingErrorCode =
  | 'not_connected'
  | 'wrong_chain'
  | 'user_rejected'
  | 'rpc_unavailable'
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

/** Classify wallet/connect errors for Bonding WalletControl (writes expand in Bước 5). */
export function classifyBondingError(error: unknown): BondingErrorCode {
  const message = messageOf(error).toLowerCase();
  if (!message) return 'generic';
  if (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('rejected the request')
  ) {
    return 'user_rejected';
  }
  if (
    message.includes('wrong chain') ||
    message.includes('chain mismatch') ||
    message.includes('Unrecognized chain')
  ) {
    return 'wrong_chain';
  }
  if (
    message.includes('not connected') ||
    message.includes('no connector') ||
    message.includes('connector not found')
  ) {
    return 'not_connected';
  }
  if (
    message.includes('rpc') ||
    message.includes('network') ||
    message.includes('fetch failed')
  ) {
    return 'rpc_unavailable';
  }
  return 'generic';
}

const VI: Record<BondingErrorCode, string> = {
  not_connected: 'Chưa kết nối ví.',
  wrong_chain: 'Vui lòng chuyển sang mạng Polygon.',
  user_rejected: 'Bạn đã từ chối yêu cầu trên ví.',
  rpc_unavailable: 'RPC tạm thời không khả dụng. Thử lại sau.',
  generic: 'Đã xảy ra lỗi. Thử lại sau.',
};

const EN: Record<BondingErrorCode, string> = {
  not_connected: 'Wallet is not connected.',
  wrong_chain: 'Please switch to the Polygon network.',
  user_rejected: 'You rejected the wallet request.',
  rpc_unavailable: 'RPC is temporarily unavailable. Try again later.',
  generic: 'Something went wrong. Try again later.',
};

export function formatBondingError(
  error: unknown,
  locale: SiteLocale,
): string {
  const code = classifyBondingError(error);
  return locale === 'en' ? EN[code] : VI[code];
}
