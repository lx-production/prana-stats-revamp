import { createServerCache } from '../helpers/cacheHelpers.ts';
import { SERVER_CACHE_TTL_MS } from '../../constants/cachePolicy.ts';
import { loadTopHoldingAddresses } from '../../scripts/update-top-holding-addresses.ts';
import type { TopHoldingAddressesBuildOutput } from '../../types/types.ts';

const topHoldingAddressesCache = createServerCache<TopHoldingAddressesBuildOutput>(
  SERVER_CACHE_TTL_MS.topHoldingsRefresh,
);

export function loadCachedTopHoldingAddresses(): Promise<TopHoldingAddressesBuildOutput> {
  return topHoldingAddressesCache(loadTopHoldingAddresses);
}
