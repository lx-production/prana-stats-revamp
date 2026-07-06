import type { IncomingMessage } from 'node:http';

type RateLimitBucket = {
  windowStartedAt: number;
  count: number;
};

type RateLimit = {
  windowMs: number;
  maxRequests: number;
};

const SWAP_QUOTE_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 10 };
const SWAP_GLOBAL_QUOTE_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 60 };
const SWAP_LOG_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 120 };
const SWAP_VERIFY_RATE_LIMIT: RateLimit = { windowMs: 60_000, maxRequests: 10 };
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;
const DEFAULT_TRUSTED_PROXY_HOP_COUNT = 1;

function normalizeSocketAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
}

function createTrustedProxyAddresses(): Set<string> {
  return new Set([
    '127.0.0.1',
    '::1',
    ...(process.env.TRUSTED_PROXY_IPS || '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)
      .map(normalizeSocketAddress),
  ]);
}

function isTrustedProxy(address: string, trustedProxyAddresses: Set<string>): boolean {
  return trustedProxyAddresses.has(normalizeSocketAddress(address));
}

function createTrustedProxyHopCount(): number {
  const parsedHopCount = Number(process.env.TRUSTED_PROXY_HOP_COUNT);

  if (!Number.isInteger(parsedHopCount) || parsedHopCount < 1) {
    return DEFAULT_TRUSTED_PROXY_HOP_COUNT;
  }

  return parsedHopCount;
}

function getRequestIp(
  req: IncomingMessage,
  trustedProxyAddresses: Set<string>,
  trustedProxyHopCount: number,
): string {
  const socketAddress = req.socket.remoteAddress ?? 'unknown';
  const forwardedFor = req.headers['x-forwarded-for'];

  if (isTrustedProxy(socketAddress, trustedProxyAddresses) && forwardedFor) {
    const forwardedHeader = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    const forwardedIps = forwardedHeader.split(',').map((ip) => ip.trim()).filter(Boolean);
    const clientIp = forwardedIps[Math.max(0, forwardedIps.length - trustedProxyHopCount)];

    if (clientIp) {
      return clientIp;
    }
  }

  return normalizeSocketAddress(socketAddress);
}

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

function isRateLimited(
  req: IncomingMessage,
  buckets: Map<string, RateLimitBucket>,
  limit: RateLimit,
  trustedProxyAddresses: Set<string>,
  trustedProxyHopCount: number,
): boolean {
  const now = Date.now();
  const key = getRequestIp(req, trustedProxyAddresses, trustedProxyHopCount);
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartedAt > limit.windowMs) {
    buckets.set(key, { windowStartedAt: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit.maxRequests;
}

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

export function createSwapRateLimiters() {
  const trustedProxyAddresses = createTrustedProxyAddresses();
  const trustedProxyHopCount = createTrustedProxyHopCount();
  const swapQuoteRateLimits = new Map<string, RateLimitBucket>();
  let globalSwapQuoteRateLimit: RateLimitBucket | null = null;
  const swapLogRateLimits = new Map<string, RateLimitBucket>();
  const swapVerifyRateLimits = new Map<string, RateLimitBucket>();

  return {
    isSwapQuoteRateLimited(req: IncomingMessage): boolean {
      if (isRateLimited(
        req,
        swapQuoteRateLimits,
        SWAP_QUOTE_RATE_LIMIT,
        trustedProxyAddresses,
        trustedProxyHopCount,
      )) {
        return true;
      }

      const globalResult = isGlobalRateLimited(globalSwapQuoteRateLimit, SWAP_GLOBAL_QUOTE_RATE_LIMIT);
      globalSwapQuoteRateLimit = globalResult.bucket;
      return globalResult.limited;
    },

    isSwapLogRateLimited(req: IncomingMessage): boolean {
      return isRateLimited(
        req,
        swapLogRateLimits,
        SWAP_LOG_RATE_LIMIT,
        trustedProxyAddresses,
        trustedProxyHopCount,
      );
    },

    isSwapVerifyRateLimited(req: IncomingMessage): boolean {
      return isRateLimited(
        req,
        swapVerifyRateLimits,
        SWAP_VERIFY_RATE_LIMIT,
        trustedProxyAddresses,
        trustedProxyHopCount,
      );
    },

    startCleanupTimer(): void {
      const rateLimitCleanupTimer = setInterval(() => {
        const now = Date.now();
        sweepRateLimitBuckets(swapQuoteRateLimits, now, SWAP_QUOTE_RATE_LIMIT.windowMs);
        if (
          globalSwapQuoteRateLimit &&
          now - globalSwapQuoteRateLimit.windowStartedAt > SWAP_GLOBAL_QUOTE_RATE_LIMIT.windowMs
        ) {
          globalSwapQuoteRateLimit = null;
        }
        sweepRateLimitBuckets(swapLogRateLimits, now, SWAP_LOG_RATE_LIMIT.windowMs);
        sweepRateLimitBuckets(swapVerifyRateLimits, now, SWAP_VERIFY_RATE_LIMIT.windowMs);
      }, RATE_LIMIT_CLEANUP_INTERVAL_MS);
      rateLimitCleanupTimer.unref();
    },
  };
}

export type SwapRateLimiters = ReturnType<typeof createSwapRateLimiters>;
