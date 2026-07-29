import { createServerCache } from '../../helpers/cacheHelpers.ts';
import { loadBondingConfig } from '../bondingConfig.ts';
import { SERVER_CACHE_TTL_MS } from '../../../constants/cachePolicy.ts';

import type { BondingConfig } from '../../../features/bonding/bonding.types.ts';

// 30s server cache — matches browser Cache-Control for /api/bonding/config
const bondingConfigCache = createServerCache<BondingConfig>(SERVER_CACHE_TTL_MS.apiResponse);

export function loadCachedBondingConfig(): Promise<BondingConfig> {
  return bondingConfigCache(loadBondingConfig);
}
