/** Public Polygon RPC used by the browser wallet / wagmi transport. */
export const FRONTEND_POLYGON_RPC_URL = 'https://polygon.drpc.org';

/** Canonical Polygon mainnet chain id — single source for wallet + server. */
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_CHAIN_NAME = 'Polygon';

/** Polygonscan deep links (tx / address / token). */
export const POLYGONSCAN_TX_BASE_URL = 'https://polygonscan.com/tx';
export const POLYGONSCAN_ADDRESS_BASE_URL = 'https://polygonscan.com/address';
export const POLYGONSCAN_TOKEN_BASE_URL = 'https://polygonscan.com/token';

/** Time units used by staking interest math (matches Solidity DAY / year). */
export const SECONDS_PER_DAY = 86_400;
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
