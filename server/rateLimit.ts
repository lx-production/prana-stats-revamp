import type { IncomingMessage } from 'node:http';

// Tracks how many requests one client made inside the current time window.
type RateLimitBucket = {
  windowStartedAt: number;
  count: number;
};

// A fixed-window limit: allow up to `maxRequests` inside each `windowMs` period.
type RateLimit = {
  windowMs: number;
  maxRequests: number;
};

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

// When X-Forwarded-For is present, take the last entry by default (one reverse proxy).
const DEFAULT_TRUSTED_PROXY_HOP_COUNT = 1;

// Only trust X-Forwarded-For from localhost proxies (Vite in dev, Pi nginx in prod).
const TRUSTED_PROXY_ADDRESSES = new Set(['127.0.0.1', '::1']);

// Node often reports IPv4 clients as IPv4-mapped IPv6 (for example ::ffff:127.0.0.1).
function normalizeSocketAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
}

function isTrustedProxy(address: string): boolean {
  return TRUSTED_PROXY_ADDRESSES.has(normalizeSocketAddress(address));
}

// How many trusted proxies append to X-Forwarded-For before Node sees the header.
// Prod (user -> VPS nginx -> Pi nginx -> Node) sets TRUSTED_PROXY_HOP_COUNT=2 so
// "<real client>, 127.0.0.1" resolves to the real client (2nd entry from the right).
function createTrustedProxyHopCount(): number {
  const parsedHopCount = Number(process.env.TRUSTED_PROXY_HOP_COUNT);

  if (!Number.isInteger(parsedHopCount) || parsedHopCount < 1) {
    return DEFAULT_TRUSTED_PROXY_HOP_COUNT;
  }

  return parsedHopCount;
}

// Pick the client IP used as the rate-limit key.
// Untrusted callers cannot spoof X-Forwarded-For; we use their socket address instead.
function getRequestIp(req: IncomingMessage, trustedProxyHopCount: number): string {
  const socketAddress = req.socket.remoteAddress ?? 'unknown'; // the IP of whoever directly connected to our Node server
  const forwardedFor = req.headers['x-forwarded-for'];

  // Prod path. Vite doesn't set X-Forwarded-For, so we trust the socket address.
  if (isTrustedProxy(socketAddress) && forwardedFor) {
    const forwardedHeader = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    const forwardedIps = forwardedHeader.split(',').map((ip) => ip.trim()).filter(Boolean);

    // X-Forwarded-For is ordered client-first, proxy-last. Count backward by hop count.
    const clientIp = forwardedIps[Math.max(0, forwardedIps.length - trustedProxyHopCount)];

    if (clientIp) {
      return clientIp;
    }
  }

  return normalizeSocketAddress(socketAddress);
}

// Remove buckets whose window has fully expired.
function sweepRateLimitBuckets(
  buckets: Map<string, RateLimitBucket>,
  now: number,
  windowMs: number,
): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt > windowMs) {
      buckets.delete(key);
    }
  }
}

// Per-IP fixed-window limiter. Returns true when this request should be rejected.
function isRateLimited(
  req: IncomingMessage,
  buckets: Map<string, RateLimitBucket>,
  limit: RateLimit,
  trustedProxyHopCount: number,
): boolean {
  const now = Date.now();
  const key = getRequestIp(req, trustedProxyHopCount);
  const bucket = buckets.get(key);

  // Start a fresh window for a new IP or after the previous window expired.
  if (!bucket || now - bucket.windowStartedAt > limit.windowMs) {
    // starts at 1 because we're including the request being handled right now
    buckets.set(key, { windowStartedAt: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit.maxRequests;
}

// Server-wide limiter (one shared bucket, not keyed by IP).
function isGlobalRateLimited(
  bucket: RateLimitBucket | null,
  limit: RateLimit,
): { bucket: RateLimitBucket; limited: boolean } {
  const now = Date.now();

  if (!bucket || now - bucket.windowStartedAt > limit.windowMs) {
    return {
      bucket: { windowStartedAt: now, count: 1 },
      limited: false,
    };
  }

  bucket.count += 1;
  return {
    bucket,
    limited: bucket.count > limit.maxRequests,
  };
}

// Factory that owns in-memory buckets for each swap endpoint.
// Call startCleanupTimer() once during server startup.
export function createSwapRateLimiters() {
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
      return isRateLimited(
        req,
        web3PostAdmissionRateLimits,
        WEB3_POST_ADMISSION_RATE_LIMIT,
        trustedProxyHopCount,
      );
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
      if (
        isRateLimited(
          req,
          stakingAccountRateLimits,
          STAKING_ACCOUNT_RATE_LIMIT,
          trustedProxyHopCount,
        )
      ) {
        return true;
      }

      const globalResult = isGlobalRateLimited(
        globalStakingAccountRateLimit,
        STAKING_ACCOUNT_GLOBAL_RATE_LIMIT,
      );
      globalStakingAccountRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Stake fund quotes: 10/IP/min + 60/server/min (typing debounce + CTA preflight).
    isStakingQuoteRateLimited(req: IncomingMessage): boolean {
      if (
        isRateLimited(
          req,
          stakingQuoteRateLimits,
          STAKING_QUOTE_RATE_LIMIT,
          trustedProxyHopCount,
        )
      ) {
        return true;
      }

      const globalResult = isGlobalRateLimited(
        globalStakingQuoteRateLimit,
        STAKING_QUOTE_GLOBAL_RATE_LIMIT,
      );
      globalStakingQuoteRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Confirmation polling: separate bucket so retries do not burn quote quota.
    isStakingConfirmRateLimited(req: IncomingMessage): boolean {
      if (
        isRateLimited(
          req,
          stakingConfirmRateLimits,
          STAKING_CONFIRM_RATE_LIMIT,
          trustedProxyHopCount,
        )
      ) {
        return true;
      }

      const globalResult = isGlobalRateLimited(
        globalStakingConfirmRateLimit,
        STAKING_CONFIRM_GLOBAL_RATE_LIMIT,
      );
      globalStakingConfirmRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Bonding quote: 10/IP/min + 60/server/min.
    isBondingQuoteRateLimited(req: IncomingMessage): boolean {
      if (
        isRateLimited(
          req,
          bondingQuoteRateLimits,
          BONDING_QUOTE_RATE_LIMIT,
          trustedProxyHopCount,
        )
      ) {
        return true;
      }

      const globalResult = isGlobalRateLimited(
        globalBondingQuoteRateLimit,
        BONDING_QUOTE_GLOBAL_RATE_LIMIT,
      );
      globalBondingQuoteRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Bonding account: 10/IP/min + 120/server/min (same shape as staking account).
    isBondingAccountRateLimited(req: IncomingMessage): boolean {
      if (
        isRateLimited(
          req,
          bondingAccountRateLimits,
          BONDING_ACCOUNT_RATE_LIMIT,
          trustedProxyHopCount,
        )
      ) {
        return true;
      }

      const globalResult = isGlobalRateLimited(
        globalBondingAccountRateLimit,
        BONDING_ACCOUNT_GLOBAL_RATE_LIMIT,
      );
      globalBondingAccountRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    // Confirmation polling: separate bucket so retries do not burn quote quota.
    isBondingConfirmRateLimited(req: IncomingMessage): boolean {
      if (
        isRateLimited(
          req,
          bondingConfirmRateLimits,
          BONDING_CONFIRM_RATE_LIMIT,
          trustedProxyHopCount,
        )
      ) {
        return true;
      }

      const globalResult = isGlobalRateLimited(
        globalBondingConfirmRateLimit,
        BONDING_CONFIRM_GLOBAL_RATE_LIMIT,
      );
      globalBondingConfirmRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    getClientIp(req: IncomingMessage): string {
      return getRequestIp(req, trustedProxyHopCount);
    },

    startCleanupTimer(): void {
      const rateLimitCleanupTimer = setInterval(() => {
        const now = Date.now();
        sweepRateLimitBuckets(
          web3PostAdmissionRateLimits,
          now,
          WEB3_POST_ADMISSION_RATE_LIMIT.windowMs,
        );
        sweepRateLimitBuckets(swapQuoteRateLimits, now, SWAP_QUOTE_RATE_LIMIT.windowMs);

        if (
          globalSwapQuoteRateLimit &&
          now - globalSwapQuoteRateLimit.windowStartedAt > SWAP_GLOBAL_QUOTE_RATE_LIMIT.windowMs
        ) {
          globalSwapQuoteRateLimit = null;
        }

        sweepRateLimitBuckets(swapLogRateLimits, now, SWAP_LOG_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(swapVerifyRateLimits, now, SWAP_VERIFY_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(stakingAccountRateLimits, now, STAKING_ACCOUNT_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(stakingQuoteRateLimits, now, STAKING_QUOTE_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(stakingConfirmRateLimits, now, STAKING_CONFIRM_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(bondingQuoteRateLimits, now, BONDING_QUOTE_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(bondingAccountRateLimits, now, BONDING_ACCOUNT_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(bondingConfirmRateLimits, now, BONDING_CONFIRM_RATE_LIMIT.windowMs);

        if (
          globalStakingAccountRateLimit &&
          now - globalStakingAccountRateLimit.windowStartedAt >
            STAKING_ACCOUNT_GLOBAL_RATE_LIMIT.windowMs
        ) {
          globalStakingAccountRateLimit = null;
        }

        if (
          globalStakingQuoteRateLimit &&
          now - globalStakingQuoteRateLimit.windowStartedAt >
            STAKING_QUOTE_GLOBAL_RATE_LIMIT.windowMs
        ) {
          globalStakingQuoteRateLimit = null;
        }

        if (
          globalStakingConfirmRateLimit &&
          now - globalStakingConfirmRateLimit.windowStartedAt >
            STAKING_CONFIRM_GLOBAL_RATE_LIMIT.windowMs
        ) {
          globalStakingConfirmRateLimit = null;
        }

        if (
          globalBondingQuoteRateLimit &&
          now - globalBondingQuoteRateLimit.windowStartedAt >
            BONDING_QUOTE_GLOBAL_RATE_LIMIT.windowMs
        ) {
          globalBondingQuoteRateLimit = null;
        }

        if (
          globalBondingAccountRateLimit &&
          now - globalBondingAccountRateLimit.windowStartedAt >
            BONDING_ACCOUNT_GLOBAL_RATE_LIMIT.windowMs
        ) {
          globalBondingAccountRateLimit = null;
        }

        if (
          globalBondingConfirmRateLimit &&
          now - globalBondingConfirmRateLimit.windowStartedAt >
            BONDING_CONFIRM_GLOBAL_RATE_LIMIT.windowMs
        ) {
          globalBondingConfirmRateLimit = null;
        }
      }, RATE_LIMIT_CLEANUP_INTERVAL_MS);

      // Let Node exit even if this interval is still running.
      rateLimitCleanupTimer.unref();
    },
  };
}

export type SwapRateLimiters = ReturnType<typeof createSwapRateLimiters>;
