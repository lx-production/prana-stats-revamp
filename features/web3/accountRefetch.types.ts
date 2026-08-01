/**
 * React Query-like refetch() result shape used by account refetch gates.
 * Feature account types are supplied via the generic — this module stays
 * domain-neutral.
 */
export type RefetchLikeResult<TAccount extends { address: string }> = {
  isSuccess?: boolean;
  status?: string;
  error?: unknown;
  data?: TAccount;
};
