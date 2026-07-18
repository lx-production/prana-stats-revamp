import { createServerCache } from '../helpers/cacheHelpers.ts';
import { SERVER_CACHE_TTL_MS } from '../../constants/cachePolicy.ts';
import { loadTopHoldingAddresses } from '../../scripts/update-top-holding-addresses.ts';
import { TOP_HOLDING_ADDRESSES } from '../../constants/topHoldingAddresses.ts';
import type { TopHoldingAddressesBuildOutput } from '../../types/types.ts';

export const TOP_HOLDERS_PAGE_SIZE = 5;
const allTopHoldingAddressesCache = createServerCache<TopHoldingAddressesBuildOutput>(
  SERVER_CACHE_TTL_MS.topHoldingsRefresh,
);


const topHoldingAddressesCaches = new Map<number, ReturnType<typeof createServerCache<TopHoldingAddressesBuildOutput>>>();

function getPageCache(page: number) {
  let cache = topHoldingAddressesCaches.get(page);
  if (!cache) {
    cache = createServerCache<TopHoldingAddressesBuildOutput>(SERVER_CACHE_TTL_MS.topHoldingsRefresh);
    topHoldingAddressesCaches.set(page, cache);
  }
  return cache;
}

export function loadCachedTopHoldingAddresses(page?: number): Promise<TopHoldingAddressesBuildOutput> {
  if (page === undefined) {
    return allTopHoldingAddressesCache(loadTopHoldingAddresses);
  }

  const start = (page - 1) * TOP_HOLDERS_PAGE_SIZE;
  const holders = TOP_HOLDING_ADDRESSES.slice(start, start + TOP_HOLDERS_PAGE_SIZE);
  return getPageCache(page)(() => loadTopHoldingAddresses(holders));
}
