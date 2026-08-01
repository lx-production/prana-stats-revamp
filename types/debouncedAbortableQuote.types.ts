/**
 * Types for the shared debounced/abortable quote hook used by Staking and
 * Bonding. Feature wrappers keep their own request/response types and fetchers.
 */

/** Primitive parts that can form a stable request key. */
export type DebouncedAbortableQuoteRequestKeyPart =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined;

/**
 * Stable identity for quote inputs.
 * Prefer a joined string or a readonly primitive tuple — never an arbitrary
 * dependency array that needs lint dependency ignores.
 */
export type DebouncedAbortableQuoteRequestKey =
  | string
  | readonly DebouncedAbortableQuoteRequestKeyPart[];

/** Fetcher signature shared by feature quote adapters. */
export type DebouncedAbortableQuoteFetcher<TRequest, TQuote> = (
  request: TRequest,
  signal: AbortSignal,
) => Promise<TQuote>;

export type UseDebouncedAbortableQuoteInput<TRequest, TQuote> = {
  /** When false, clear state and do not schedule fetches. */
  enabled: boolean;
  /** Null means the form is incomplete — clear and idle. */
  request: TRequest | null;
  /** Stable key derived from the fields that should trigger a re-quote. */
  requestKey: DebouncedAbortableQuoteRequestKey;
  fetchQuote: DebouncedAbortableQuoteFetcher<TRequest, TQuote>;
  debounceMs: number;
  staleMs: number;
  /** Used when the fetcher throws a non-Error value. */
  fallbackErrorMessage: string;
};

export type UseDebouncedAbortableQuoteResult<TQuote> = {
  quote: TQuote | null;
  isLoading: boolean;
  error: string | null;
  /** True when a successful quote is older than `staleMs`. */
  isStale: boolean;
  /** Epoch ms when the current quote was received (null if none). */
  quotedAtMs: number | null;
  /**
   * Immediate (non-debounced) quote refresh for CTA preflight.
   * Returns the fresh quote, or null on abort/failure.
   */
  freshQuote: () => Promise<TQuote | null>;
  /** Abort in-flight work, bump request id, and reset all quote state. */
  invalidate: () => void;
};
