const inFlight = new Map<string, Promise<unknown>>();

function getRequestKey(url: string, init?: RequestInit) {
  const method = (init?.method ?? 'GET').toUpperCase();
  // Only dedupe GET requests; other methods can have side effects.
  if (method !== 'GET') return null;
  // Minimal key: this repo uses simple GETs without custom headers.
  return url;
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const key = getRequestKey(url, init);
  const existing = key ? inFlight.get(key) : null;
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`Failed to fetch JSON: ${url} (HTTP ${res.status})`);
    }
    return (await res.json()) as T;
  })();

  if (key) inFlight.set(key, promise as Promise<unknown>);
  try {
    return await promise;
  } finally {
    if (key) inFlight.delete(key);
  }
}

