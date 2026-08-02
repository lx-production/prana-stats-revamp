// Tracks how many requests one client made inside the current time window.
export type RateLimitBucket = {
  windowStartedAt: number;
  count: number;
};

// A fixed-window limit: allow up to `maxRequests` inside each `windowMs` period.
export type RateLimit = {
  windowMs: number;
  maxRequests: number;
};
