// Fetches JSON from a URL with request deduplication for GET requests.
// Multiple simultaneous requests to the same GET endpoint share a single network call.
// Tracks in-flight requests by URL to deduplicate concurrent GET requests
const inFlight = new Map<string, Promise<unknown>>();

function getRequestKey(url: string, init?: RequestInit) {
  const method = (init?.method ?? 'GET').toUpperCase();
  // Only dedupe GET requests; other methods can have side effects.
  if (method !== 'GET') return null;
  // Minimal key: this repo uses simple GETs without custom headers.
  // Dùng chính url làm key
  return url;
}

/**
 * - Works with any URL (JSON files or API endpoints), with GET request deduplication.
 * - Parses the response as JSON and returns the parsed object.
 * - If a dedupeKey is provided (or generated for GETs with getRequestKey), only one in-flight fetch to that key is allowed at a time.
 * - If a request for the same key is already in progress, return the same Promise instead of issuing a new network call.
 * - If dedupeKey is null, deduplication is disabled and a new request is always sent.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
  options?: { dedupeKey?: string | null },
): Promise<T> {
  const key = options?.dedupeKey === null ? null : (options?.dedupeKey ?? getRequestKey(url, init));
  const existing = key ? inFlight.get(key) : null;
  if (existing) return existing as Promise<T>;

  // Create new fetch promise
  const promise = (async () => {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`Failed to fetch JSON: ${url} (HTTP ${res.status})`);
    }
    return (await res.json()) as T;
  })();

  // Store promise for GET requests to enable deduplication
  if (key) inFlight.set(key, promise as Promise<unknown>);
  try {
    return await promise;
  } finally {
    // Clean up after request completes (success or error)
    if (key) inFlight.delete(key);
  }
}

// Fetches JSON with error handling - returns fallback value on failure instead of throwing.
export async function fetchJsonSafe<T>(
  url: string,
  fallback: T,
  init?: RequestInit,
  options?: { dedupeKey?: string | null },
): Promise<T> {
  try {
    return await fetchJson<T>(url, init, options);
  } catch (e) {
    console.warn(`Failed to fetch ${url}`, e);
    return fallback;
  }
}