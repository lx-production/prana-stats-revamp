type InflightEntry = Promise<unknown>;

const inflightJsonRequests = new Map<string, InflightEntry>();

const makeKey = (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  // We only use this helper for GET JSON requests in this app.
  // Keeping the key minimal avoids subtle differences (like header order).
  return `${method}:${url}`;
};

export async function fetchJsonDedupe<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const key = makeKey(url, init);
  const existing = inflightJsonRequests.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`Failed to fetch JSON: ${url} (HTTP ${res.status})`);
    }
    return (await res.json()) as T;
  })();

  inflightJsonRequests.set(key, promise);

  try {
    return await (promise as Promise<T>);
  } finally {
    inflightJsonRequests.delete(key);
  }
}


