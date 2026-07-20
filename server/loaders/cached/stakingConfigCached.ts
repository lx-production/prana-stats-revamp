import { loadStakingConfig } from '../stakingConfig.ts';
import { createServerCache } from '../../helpers/cacheHelpers.ts';
import { SERVER_CACHE_TTL_MS } from '../../../constants/cachePolicy.ts';

import type { StakingConfig } from '../../../features/staking/staking.types.ts';

// 30s server cache — matches browser Cache-Control for /api/staking/config
const stakingConfigCache = createServerCache<StakingConfig>(SERVER_CACHE_TTL_MS.apiResponse);

export function loadCachedStakingConfig(): Promise<StakingConfig> {
  return stakingConfigCache(loadStakingConfig);
}
