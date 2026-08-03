/**
 * Post-receipt account refresh for Staking/Bonding.
 * Runs after the UI already reports transaction success (swap-like timing).
 */
export type SyncAccountAfterConfirmDependencies = {
  refetchAccount: () => Promise<unknown>;
  /**
   * Feature-supplied gate (usually `accountFromSuccessfulRefetch`).
   * Shared helper stays domain-neutral — no Staking/Bonding account types.
   */
  isSuccessfulRefetch: (refreshed: unknown) => boolean;
};

export type SyncAccountAfterConfirmResult = {
  /** True when refetch threw or failed the success gate — non-fatal for the tx. */
  syncFailed: boolean;
};
