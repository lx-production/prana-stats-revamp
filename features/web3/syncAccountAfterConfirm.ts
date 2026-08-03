import type {
  SyncAccountAfterConfirmDependencies,
  SyncAccountAfterConfirmResult,
} from './syncAccountAfterConfirm.types.ts';

/**
 * Refresh account after a confirmed receipt.
 * Callers show success first, then run this in the background (fire-and-forget
 * or await without blocking the success UI). Failures stay non-fatal.
 */
export async function syncAccountAfterConfirm(
  deps: SyncAccountAfterConfirmDependencies,
): Promise<SyncAccountAfterConfirmResult> {
  try {
    const refreshed = await deps.refetchAccount();
    if (!deps.isSuccessfulRefetch(refreshed)) {
      return { syncFailed: true };
    }
    return { syncFailed: false };
  } catch {
    return { syncFailed: true };
  }
}
