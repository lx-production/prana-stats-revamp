import { createTrustedProxyHopCount, expireGlobalRateLimitBucket, getRequestIp, isGlobalRateLimited, isRateLimited, sweepRateLimitBuckets } from './helpers/rateLimitHelpers.ts';

import type { IncomingMessage } from 'node:http';
import type { RateLimit, RateLimitBucket } from './types/rateLimit.types.ts';

// Cheap shared admission for all Web3 POSTs — before body parse / expensive RPC budgets.
// Generous so real quote/confirm traffic is not starved; edge nginx still caps flood volume.
const WEB3_POST_ADMISSION_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 300 };

// Per-IP limits for swap API endpoints (all windows are 60 seconds).
const SWAP_QUOTE_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 5 };
const SWAP_GLOBAL_QUOTE_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 30 };
const SWAP_LOG_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 30 };
const SWAP_VERIFY_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 10 };

// Staking account reads hit Alchemy/Pi — tighter than public config, looser than quotes.
const STAKING_ACCOUNT_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 10 };
const STAKING_ACCOUNT_GLOBAL_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 120 };

// Fully-funded stake quotes (debounced typing + CTA preflight) — same shape as bonding quotes.
const STAKING_QUOTE_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 10 };
const STAKING_QUOTE_GLOBAL_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 60 };

// Staking confirmation has its own bucket so hash polling does not consume quote quota.
const STAKING_CONFIRM_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 30 };
const STAKING_CONFIRM_GLOBAL_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 120 };

// Bonding APIs share the same in-memory store; confirmation has its own bucket so hash polling
// does not consume quote quota.
const BONDING_QUOTE_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 10 };
const BONDING_QUOTE_GLOBAL_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 60 };
const BONDING_ACCOUNT_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 10 };
const BONDING_ACCOUNT_GLOBAL_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 120 };
const BONDING_CONFIRM_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 30 };
const BONDING_CONFIRM_GLOBAL_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 120 };

// How often we delete expired per-IP buckets so memory does not grow forever.
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000; // 1 minute

// Factory that owns in-memory buckets for swap, staking, and bonding API endpoints.
// Call startCleanupTimer() once during server startup.
export function createWeb3RateLimiters() {
  const trustedProxyHopCount = createTrustedProxyHopCount();

  // const means binding never changes (Maps are updated in place)
  const web3PostAdmissionRateLimits = new Map<string, RateLimitBucket>();
  const swapQuoteRateLimits = new Map<string, RateLimitBucket>();
  const swapLogRateLimits = new Map<string, RateLimitBucket>();
  const swapVerifyRateLimits = new Map<string, RateLimitBucket>();
  const stakingAccountRateLimits = new Map<string, RateLimitBucket>();
  const stakingQuoteRateLimits = new Map<string, RateLimitBucket>();
  const stakingConfirmRateLimits = new Map<string, RateLimitBucket>();
  const bondingQuoteRateLimits = new Map<string, RateLimitBucket>();
  const bondingAccountRateLimits = new Map<string, RateLimitBucket>();
  const bondingConfirmRateLimits = new Map<string, RateLimitBucket>();

  let globalSwapQuoteRateLimit: RateLimitBucket | null = null;
  let globalStakingAccountRateLimit: RateLimitBucket | null = null;
  let globalStakingQuoteRateLimit: RateLimitBucket | null = null;
  let globalStakingConfirmRateLimit: RateLimitBucket | null = null;
  let globalBondingQuoteRateLimit: RateLimitBucket | null = null;
  let globalBondingAccountRateLimit: RateLimitBucket | null = null;
  let globalBondingConfirmRateLimit: RateLimitBucket | null = null;
  // let is used because global* buckets get reassigned, while the Maps only get mutated

  return {
    // Shared cheap admission for Swap/Staking/Bonding POSTs (per-IP only, no global).
    isWeb3PostAdmissionRateLimited(req: IncomingMessage): boolean {
      return isRateLimited(req, web3PostAdmissionRateLimits, WEB3_POST_ADMISSION_RATE_LIMIT, trustedProxyHopCount); 
    },

    // Quote requests hit both a per-IP cap and a global cap across all clients.
    isSwapQuoteRateLimited(req: IncomingMessage): boolean {
      if (isRateLimited(req, swapQuoteRateLimits, SWAP_QUOTE_RATE_LIMIT, trustedProxyHopCount)) {
        return true;
      }

      const globalResult = isGlobalRateLimited(globalSwapQuoteRateLimit, SWAP_GLOBAL_QUOTE_RATE_LIMIT);
      globalSwapQuoteRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    isSwapLogRateLimited(req: IncomingMessage): boolean {
      return isRateLimited(req, swapLogRateLimits, SWAP_LOG_RATE_LIMIT, trustedProxyHopCount);
    },

    isSwapVerifyRateLimited(req: IncomingMessage): boolean {
      return isRateLimited(req, swapVerifyRateLimits, SWAP_VERIFY_RATE_LIMIT, trustedProxyHopCount);
    },

    // Wallet account snapshots: 10/IP/min + 120/server/min to protect Pi/Alchemy.
    isStakingAccountRateLimited(req: IncomingMessage): boolean {
      if (isRateLimited(req, stakingAccountRateLimits, STAKING_ACCOUNT_RATE_LIMIT, trustedProxyHopCount)) {
        return true;
      }

      const globalResult = isGlobalRateLimited(globalStakingAccountRateLimit, STAKING_ACCOUNT_GLOBAL_RATE_LIMIT);
      globalStakingAccountRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Stake fund quotes: 10/IP/min + 60/server/min (typing debounce + CTA preflight).
    isStakingQuoteRateLimited(req: IncomingMessage): boolean {
      if (isRateLimited(req, stakingQuoteRateLimits, STAKING_QUOTE_RATE_LIMIT, trustedProxyHopCount)) {
        return true;
      }

      const globalResult = isGlobalRateLimited(globalStakingQuoteRateLimit, STAKING_QUOTE_GLOBAL_RATE_LIMIT);
      globalStakingQuoteRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Confirmation polling: separate bucket so retries do not burn quote quota.
    isStakingConfirmRateLimited(req: IncomingMessage): boolean {
      if (isRateLimited(req, stakingConfirmRateLimits, STAKING_CONFIRM_RATE_LIMIT, trustedProxyHopCount)) {
        return true;
      }

      const globalResult = isGlobalRateLimited(globalStakingConfirmRateLimit, STAKING_CONFIRM_GLOBAL_RATE_LIMIT);
      globalStakingConfirmRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Bonding quote: 10/IP/min + 60/server/min.
    isBondingQuoteRateLimited(req: IncomingMessage): boolean {
      if (isRateLimited(req, bondingQuoteRateLimits, BONDING_QUOTE_RATE_LIMIT, trustedProxyHopCount)) {
        return true;
      }

      const globalResult = isGlobalRateLimited(globalBondingQuoteRateLimit, BONDING_QUOTE_GLOBAL_RATE_LIMIT);
      globalBondingQuoteRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Bonding account: 10/IP/min + 120/server/min (same shape as staking account).
    isBondingAccountRateLimited(req: IncomingMessage): boolean {
      if (isRateLimited(req, bondingAccountRateLimits, BONDING_ACCOUNT_RATE_LIMIT, trustedProxyHopCount)) {
        return true;
      }

      const globalResult = isGlobalRateLimited(globalBondingAccountRateLimit, BONDING_ACCOUNT_GLOBAL_RATE_LIMIT);
      globalBondingAccountRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Confirmation polling: separate bucket so retries do not burn quote quota.
    isBondingConfirmRateLimited(req: IncomingMessage): boolean {
      if (isRateLimited(req, bondingConfirmRateLimits, BONDING_CONFIRM_RATE_LIMIT, trustedProxyHopCount)) {
        return true;
      }

      const globalResult = isGlobalRateLimited(globalBondingConfirmRateLimit, BONDING_CONFIRM_GLOBAL_RATE_LIMIT);
      globalBondingConfirmRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    getClientIp(req: IncomingMessage): string {
      return getRequestIp(req, trustedProxyHopCount);
    },

    startCleanupTimer(): void {
      const rateLimitCleanupTimer = setInterval(() => {
        const now = Date.now();

        // Per-IP maps
        sweepRateLimitBuckets(web3PostAdmissionRateLimits, now, WEB3_POST_ADMISSION_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(swapQuoteRateLimits, now, SWAP_QUOTE_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(swapLogRateLimits, now, SWAP_LOG_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(swapVerifyRateLimits, now, SWAP_VERIFY_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(stakingAccountRateLimits, now, STAKING_ACCOUNT_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(stakingQuoteRateLimits, now, STAKING_QUOTE_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(stakingConfirmRateLimits, now, STAKING_CONFIRM_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(bondingQuoteRateLimits, now, BONDING_QUOTE_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(bondingAccountRateLimits, now, BONDING_ACCOUNT_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(bondingConfirmRateLimits, now, BONDING_CONFIRM_RATE_LIMIT.windowMs);

        // Server-wide single buckets
        globalSwapQuoteRateLimit = expireGlobalRateLimitBucket(globalSwapQuoteRateLimit, now, SWAP_GLOBAL_QUOTE_RATE_LIMIT.windowMs);
        globalStakingAccountRateLimit = expireGlobalRateLimitBucket(globalStakingAccountRateLimit, now, STAKING_ACCOUNT_GLOBAL_RATE_LIMIT.windowMs);
        globalStakingQuoteRateLimit = expireGlobalRateLimitBucket(globalStakingQuoteRateLimit, now, STAKING_QUOTE_GLOBAL_RATE_LIMIT.windowMs);
        globalStakingConfirmRateLimit = expireGlobalRateLimitBucket(globalStakingConfirmRateLimit, now, STAKING_CONFIRM_GLOBAL_RATE_LIMIT.windowMs);
        globalBondingQuoteRateLimit = expireGlobalRateLimitBucket(globalBondingQuoteRateLimit, now, BONDING_QUOTE_GLOBAL_RATE_LIMIT.windowMs);
        globalBondingAccountRateLimit = expireGlobalRateLimitBucket(globalBondingAccountRateLimit, now, BONDING_ACCOUNT_GLOBAL_RATE_LIMIT.windowMs);
        globalBondingConfirmRateLimit = expireGlobalRateLimitBucket(globalBondingConfirmRateLimit, now, BONDING_CONFIRM_GLOBAL_RATE_LIMIT.windowMs);
      }, RATE_LIMIT_CLEANUP_INTERVAL_MS);

      // Let Node exit even if this interval is still running.
      rateLimitCleanupTimer.unref();
    },
  };
}

export type Web3RateLimiters = ReturnType<typeof createWeb3RateLimiters>;
