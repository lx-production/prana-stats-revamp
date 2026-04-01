import { TOP_HOLDING_ADDRESSES, type TopHoldingAddress } from '../constants/topHoldingAddresses.ts';

export const TOP_HOLDING_ADDRESSES_PAGE_SIZE = 10;

export function getTopHoldingAddressesTotalPages() {
  return Math.max(1, Math.ceil(TOP_HOLDING_ADDRESSES.length / TOP_HOLDING_ADDRESSES_PAGE_SIZE));
}

export function clampTopHoldingAddressesPage(page: number) {
  if (!Number.isFinite(page)) return 1;
  const normalizedPage = Math.trunc(page);
  return Math.min(Math.max(normalizedPage, 1), getTopHoldingAddressesTotalPages());
}

export function getTopHoldingAddressesPageStartIndex(page: number) {
  return (clampTopHoldingAddressesPage(page) - 1) * TOP_HOLDING_ADDRESSES_PAGE_SIZE;
}

export function getTopHoldingAddressesPage(page: number): TopHoldingAddress[] {
  const startIndex = getTopHoldingAddressesPageStartIndex(page);
  return TOP_HOLDING_ADDRESSES.slice(startIndex, startIndex + TOP_HOLDING_ADDRESSES_PAGE_SIZE);
}
