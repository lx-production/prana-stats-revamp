import type { IncomingMessage } from 'node:http';

import type { RateLimit, RateLimitBucket } from '../types/rateLimit.types.ts';

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
export function createTrustedProxyHopCount(): number {
  const parsedHopCount = Number(process.env.TRUSTED_PROXY_HOP_COUNT);

  if (!Number.isInteger(parsedHopCount) || parsedHopCount < 1) {
    return DEFAULT_TRUSTED_PROXY_HOP_COUNT;
  }

  return parsedHopCount;
}

// Pick the client IP used as the rate-limit key.
// Untrusted callers cannot spoof X-Forwarded-For; we use their socket address instead.
export function getRequestIp(req: IncomingMessage, trustedProxyHopCount: number): string {
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
export function sweepRateLimitBuckets(
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

// Drop a server-wide bucket once its window has fully expired.
export function expireGlobalRateLimitBucket(
  bucket: RateLimitBucket | null,
  now: number,
  windowMs: number,
): RateLimitBucket | null {
  if (bucket && now - bucket.windowStartedAt > windowMs) return null;
  return bucket;
}

// Per-IP fixed-window limiter. Returns true when this request should be rejected.
export function isRateLimited(
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
export function isGlobalRateLimited(
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
