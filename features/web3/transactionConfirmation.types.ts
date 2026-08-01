/** Browser waitForTransactionReceipt-like result used by confirmation gates. */
export type WaitReceiptResult = { status: 'success' | 'reverted' };

/**
 * Minimal server confirmation statuses shared by Staking and Bonding.
 * Feature response types may carry extra fields (e.g. `source`).
 */
export type ServerConfirmationStatus =
  | 'confirmed'
  | 'reverted'
  | 'not_mined'
  | 'confirmation_unavailable';

export type ServerConfirmationResult = {
  status: ServerConfirmationStatus;
};

export type ConfirmBroadcastTransactionDependencies = {
  waitForReceipt: () => Promise<WaitReceiptResult>;
  /** Server fallback / resume validation via feature confirm-transaction API. */
  confirmOnServer: () => Promise<ServerConfirmationResult>;
  /**
   * When true (resume path), browser receipt success is not enough — server
   * must still validate sender/target/full calldata before reporting confirmed.
   */
  requireServerValidation?: boolean;
};

export type BroadcastConfirmationOutcome =
  | { kind: 'confirmed'; source: 'browser' | 'server' }
  | { kind: 'reverted'; source: 'browser' | 'server' }
  | {
      kind: 'confirmation_unavailable';
      receiptError: unknown;
      verificationError: unknown;
    };
