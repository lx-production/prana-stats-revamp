/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  confirmStakeReceipt,
  resolvePermitAndStakeAction,
  runPermitThenStake,
  submitStakeWithPermitFlow,
} from '../utils/stakeTransactionFlow.ts';

import type { Hex } from '../../../types/blockchain.types.ts';
import type { StakingAccountSnapshot } from '../staking.types.ts';

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
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
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
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
    isPermitStillValid: () => true,
    isPermitExpired: () => false,
  });
  assert.equal(outcome.kind, 'rejected_before_broadcast');
  if (outcome.kind === 'rejected_before_broadcast') {
    assert.match(String(outcome.error), /rejected/i);
  }
});

test('submitStakeWithPermitFlow confirms without waiting on account sync', async () => {
  let syncStarted = false;
  let resolveSync: ((value: unknown) => void) | null = null;

  const outcome = await submitStakeWithPermitFlow({
    refetchAccount: async () => {
      // First call is the pre-write fresh-account gate.
      if (!syncStarted) {
        return successRefetch();
      }
      // Would hang if post-receipt sync were still awaited in the submit flow.
      return await new Promise((resolve) => {
        resolveSync = resolve;
      });
    },
    writeContract: async () => HASH,
    waitForReceipt: async () => {
      syncStarted = true;
      return { status: 'success' };
    },
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
    isPermitStillValid: () => true,
    isPermitExpired: () => false,
  });

  assert.equal(outcome.kind, 'confirmed');
  // Hang resolver must still be unset — submit must not start post-receipt sync.
  assert.equal(resolveSync, null);
});

test('submitStakeWithPermitFlow does not call write twice after hash is known', async () => {
  let writeCount = 0;
  let waitCount = 0;
  let serverCalls = 0;

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
    confirmOnServer: async () => {
      serverCalls += 1;
      return { status: 'confirmation_unavailable' };
    },
    isPermitStillValid: () => true,
    isPermitExpired: () => false,
  });

  assert.equal(first.kind, 'confirmation_unavailable');
  assert.equal(writeCount, 1);
  assert.equal(serverCalls, 1);

  // Resume path: confirmStakeReceipt only — no second write.
  const resume = await confirmStakeReceipt(HASH, {
    requireServerValidation: true,
    waitForReceipt: async () => {
      waitCount += 1;
      return { status: 'success' };
    },
    confirmOnServer: async () => {
      serverCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
  });

  assert.equal(resume.kind, 'confirmed');
  assert.equal(writeCount, 1);
  assert.equal(waitCount, 2);
  assert.equal(serverCalls, 2);
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
