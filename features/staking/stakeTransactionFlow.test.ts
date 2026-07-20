import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountFromSuccessfulRefetch } from './accountRefetch.ts';
import {
  confirmStakeReceipt,
  resolvePermitAndStakeAction,
  runPermitThenStake,
  submitStakeWithPermitFlow,
} from './stakeTransactionFlow.ts';

import type { Hex } from '../../types/blockchain.types.ts';
import type { StakingAccountSnapshot } from './staking.types.ts';

const HASH = '0xabc' as Hex;

const sampleAccount: StakingAccountSnapshot = {
  address: '0x1111111111111111111111111111111111111111',
  blockNumber: 1,
  blockTimestamp: 1_700_000_000,
  balanceRaw: '1000000000000000000',
  permitNonce: '3',
  stakes: [],
};

function successRefetch(data: StakingAccountSnapshot = sampleAccount) {
  return { isSuccess: true, status: 'success', data, error: null };
}

function errorRefetch(cached: StakingAccountSnapshot = sampleAccount) {
  // React Query keeps prior data when refetch fails — must not be treated as fresh.
  return {
    isSuccess: false,
    status: 'error',
    data: cached,
    error: new Error('network'),
  };
}

test('accountFromSuccessfulRefetch ignores failed refetch with stale data', () => {
  assert.equal(accountFromSuccessfulRefetch(errorRefetch()), undefined);
  assert.equal(accountFromSuccessfulRefetch(undefined), undefined);
  assert.equal(accountFromSuccessfulRefetch({ data: sampleAccount }), undefined);
  assert.deepEqual(
    accountFromSuccessfulRefetch(successRefetch()),
    sampleAccount,
  );
});

test('resolvePermitAndStakeAction resumes receipt when a hash is pending', () => {
  assert.equal(
    resolvePermitAndStakeAction({
      hasPendingHash: true,
      hasValidPermit: true,
    }),
    'resume_receipt',
  );
  assert.equal(
    resolvePermitAndStakeAction({
      hasPendingHash: true,
      hasValidPermit: false,
    }),
    'resume_receipt',
  );
  assert.equal(
    resolvePermitAndStakeAction({
      hasPendingHash: false,
      hasValidPermit: true,
    }),
    'continue_with_permit',
  );
  assert.equal(
    resolvePermitAndStakeAction({
      hasPendingHash: false,
      hasValidPermit: false,
    }),
    'create_permit_and_stake',
  );
});

test('submitStakeWithPermitFlow does not write when fresh account refetch fails', async () => {
  let wrote = false;
  const outcome = await submitStakeWithPermitFlow({
    refetchAccount: async () => errorRefetch(),
    writeContract: async () => {
      wrote = true;
      return HASH;
    },
    waitForReceipt: async () => ({ status: 'success' }),
    isPermitStillValid: () => true,
    isPermitExpired: () => false,
  });
  assert.equal(outcome.kind, 'fresh_account_failed');
  assert.equal(wrote, false);
});

test('submitStakeWithPermitFlow keeps pre-broadcast rejection without a hash', async () => {
  const outcome = await submitStakeWithPermitFlow({
    refetchAccount: async () => successRefetch(),
    writeContract: async () => {
      throw new Error('User rejected the request');
    },
    waitForReceipt: async () => ({ status: 'success' }),
    isPermitStillValid: () => true,
    isPermitExpired: () => false,
  });
  assert.equal(outcome.kind, 'rejected_before_broadcast');
  if (outcome.kind === 'rejected_before_broadcast') {
    assert.match(String(outcome.error), /rejected/i);
  }
});

test('submitStakeWithPermitFlow does not call write twice after hash is known', async () => {
  let writeCount = 0;
  let waitCount = 0;

  const first = await submitStakeWithPermitFlow({
    refetchAccount: async () => successRefetch(),
    writeContract: async () => {
      writeCount += 1;
      return HASH;
    },
    waitForReceipt: async () => {
      waitCount += 1;
      throw new Error('RPC timeout');
    },
    isPermitStillValid: () => true,
    isPermitExpired: () => false,
  });

  assert.equal(first.kind, 'broadcast_receipt_pending');
  assert.equal(writeCount, 1);

  // Resume path: confirmStakeReceipt only — no second write.
  const resume = await confirmStakeReceipt(HASH, {
    waitForReceipt: async () => {
      waitCount += 1;
      return { status: 'success' };
    },
    refetchAccount: async () => successRefetch(),
  });

  assert.equal(resume.kind, 'confirmed');
  assert.equal(writeCount, 1);
  assert.equal(waitCount, 2);
});

test('confirmStakeReceipt keeps confirmed when post-receipt refetch fails', async () => {
  const outcome = await confirmStakeReceipt(HASH, {
    waitForReceipt: async () => ({ status: 'success' }),
    refetchAccount: async () => errorRefetch(),
  });
  assert.deepEqual(outcome, { kind: 'confirmed', syncFailed: true });
});

test('confirmStakeReceipt reports reverted without syncing account', async () => {
  let refetched = false;
  const outcome = await confirmStakeReceipt(HASH, {
    waitForReceipt: async () => ({ status: 'reverted' }),
    refetchAccount: async () => {
      refetched = true;
      return successRefetch();
    },
  });
  assert.equal(outcome.kind, 'reverted');
  assert.equal(refetched, false);
});

test('runPermitThenStake stops without submit when createPermit is rejected', async () => {
  let submitted = false;
  const result = await runPermitThenStake({
    action: 'create_permit_and_stake',
    existingPermit: null,
    createPermit: async () => null,
    submit: async () => {
      submitted = true;
    },
    resumeReceipt: async () => {},
  });
  assert.equal(result, 'stopped');
  assert.equal(submitted, false);
});

test('runPermitThenStake reuses existing permit without creating a new one', async () => {
  let created = false;
  let submittedPermit: string | null = null;
  const result = await runPermitThenStake({
    action: 'continue_with_permit',
    existingPermit: 'kept-permit',
    createPermit: async () => {
      created = true;
      return 'new-permit';
    },
    submit: async (permit) => {
      submittedPermit = permit;
    },
    resumeReceipt: async () => {},
  });
  assert.equal(result, 'submitted');
  assert.equal(created, false);
  assert.equal(submittedPermit, 'kept-permit');
});
