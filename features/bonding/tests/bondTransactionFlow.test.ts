/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountFromSuccessfulRefetch } from '../utils/accountRefetch.ts';
import {
  confirmBondReceipt,
  resolveBondCtaAction,
  runBondCtaBranch,
  submitBondWriteFlow,
} from '../utils/bondTransactionFlow.ts';

import type { Hex } from '../../../types/blockchain.types.ts';
import type { BondingAccount } from '../bonding.types.ts';

const HASH = '0xabc' as Hex;

const sampleAccount: BondingAccount = {
  address: '0x1111111111111111111111111111111111111111',
  blockNumber: 1,
  blockTimestamp: 1_700_000_000,
  pranaBalanceRaw: '1000000000',
  wbtcBalanceRaw: '100000000',
  buyV2WbtcAllowanceRaw: '0',
  sellV2PranaAllowanceRaw: '0',
  bonds: [],
};

function successRefetch(data: BondingAccount = sampleAccount) {
  return { isSuccess: true, status: 'success', data, error: null };
}

function errorRefetch(cached: BondingAccount = sampleAccount) {
  return {
    isSuccess: false,
    status: 'error',
    data: cached,
    error: new Error('network'),
  };
}

test('resolveBondCtaAction never chains approve into create on one click', () => {
  assert.equal(
    resolveBondCtaAction({
      hasPendingHash: false,
      needsApproval: true,
      createRequested: true,
    }),
    'approve',
  );
  assert.equal(
    resolveBondCtaAction({
      hasPendingHash: false,
      needsApproval: false,
      createRequested: false,
    }),
    'open_review',
  );
  assert.equal(
    resolveBondCtaAction({
      hasPendingHash: false,
      needsApproval: false,
      createRequested: true,
    }),
    'create',
  );
  assert.equal(
    resolveBondCtaAction({
      hasPendingHash: true,
      needsApproval: true,
      createRequested: true,
    }),
    'resume_confirmation',
  );
});

test('runBondCtaBranch runs exactly one branch per action', async () => {
  const calls: string[] = [];

  await runBondCtaBranch({
    action: 'approve',
    resumeConfirmation: async () => {
      calls.push('resume');
    },
    runApprove: async () => {
      calls.push('approve');
    },
    openReview: async () => {
      calls.push('review');
    },
    runCreate: async () => {
      calls.push('create');
    },
  });

  assert.deepEqual(calls, ['approve']);

  calls.length = 0;
  await runBondCtaBranch({
    action: 'open_review',
    resumeConfirmation: async () => {
      calls.push('resume');
    },
    runApprove: async () => {
      calls.push('approve');
    },
    openReview: async () => {
      calls.push('review');
    },
    runCreate: async () => {
      calls.push('create');
    },
  });
  assert.deepEqual(calls, ['review']);
});

test('submitBondWriteFlow does not write when fresh account refetch fails', async () => {
  let wrote = false;
  const outcome = await submitBondWriteFlow({
    refetchAccount: async () => errorRefetch(),
    validateFreshAccount: () => true,
    simulate: async () => {
      throw new Error('should not simulate');
    },
    write: async () => {
      wrote = true;
      return HASH;
    },
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
  });
  assert.equal(outcome.kind, 'fresh_account_failed');
  assert.equal(wrote, false);
});

test('submitBondWriteFlow does not write when simulate fails', async () => {
  let wrote = false;
  const outcome = await submitBondWriteFlow({
    refetchAccount: async () => successRefetch(),
    validateFreshAccount: () => true,
    simulate: async () => {
      throw new Error('simulation reverted');
    },
    write: async () => {
      wrote = true;
      return HASH;
    },
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
  });
  assert.equal(outcome.kind, 'simulate_failed');
  assert.equal(wrote, false);
});

test('submitBondWriteFlow keeps pre-broadcast rejection without a hash', async () => {
  const outcome = await submitBondWriteFlow({
    refetchAccount: async () => successRefetch(),
    validateFreshAccount: () => true,
    simulate: async () => ({
      address: sampleAccount.address,
      functionName: 'approve',
      args: [],
      account: sampleAccount.address,
    }),
    write: async () => {
      throw new Error('User rejected the request');
    },
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
  });
  assert.equal(outcome.kind, 'rejected_before_broadcast');
});

test('submitBondWriteFlow does not call write twice after hash is known', async () => {
  let writeCount = 0;
  let waitCount = 0;
  let serverCalls = 0;

  const first = await submitBondWriteFlow({
    refetchAccount: async () => successRefetch(),
    validateFreshAccount: () => true,
    simulate: async () => ({
      address: sampleAccount.address,
      functionName: 'sellBond',
      args: [1n, 1],
      account: sampleAccount.address,
    }),
    write: async () => {
      writeCount += 1;
      return HASH;
    },
    waitForReceipt: async () => {
      waitCount += 1;
      throw new Error('RPC timeout');
    },
    confirmOnServer: async () => {
      serverCalls += 1;
      throw new Error('server down');
    },
  });

  assert.equal(first.kind, 'confirmation_unavailable');
  assert.equal(writeCount, 1);
  assert.equal(serverCalls, 1);

  // Resume path: confirmBondReceipt only — no second write.
  const resume = await confirmBondReceipt(HASH, {
    waitForReceipt: async () => {
      waitCount += 1;
      return { status: 'success' };
    },
    confirmOnServer: async () => {
      serverCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
    refetchAccount: async () => successRefetch(),
  });

  assert.equal(resume.kind, 'confirmed');
  assert.equal(writeCount, 1);
  assert.equal(waitCount, 2);
  assert.equal(serverCalls, 1);
});

test('browser receipt success does not call server fallback', async () => {
  let serverCalls = 0;
  const outcome = await confirmBondReceipt(HASH, {
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => {
      serverCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
    refetchAccount: async () => successRefetch(),
  });
  assert.equal(outcome.kind, 'confirmed');
  if (outcome.kind === 'confirmed') {
    assert.equal(outcome.source, 'browser');
    assert.equal(outcome.syncFailed, false);
  }
  assert.equal(serverCalls, 0);
});

test('resume path requires server validation even after browser receipt success', async () => {
  let serverCalls = 0;
  const outcome = await confirmBondReceipt(HASH, {
    requireServerValidation: true,
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => {
      serverCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
    refetchAccount: async () => successRefetch(),
  });
  assert.equal(outcome.kind, 'confirmed');
  if (outcome.kind === 'confirmed') {
    assert.equal(outcome.source, 'server');
    assert.equal(outcome.syncFailed, false);
  }
  assert.equal(serverCalls, 1);
});

test('receipt success with failed account sync stays confirmed with warning flag', async () => {
  const outcome = await confirmBondReceipt(HASH, {
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
    refetchAccount: async () => errorRefetch(),
  });
  assert.equal(outcome.kind, 'confirmed');
  if (outcome.kind === 'confirmed') {
    assert.equal(outcome.syncFailed, true);
  }
});

test('reverted receipt does not report success or sync account as success path', async () => {
  let synced = false;
  const outcome = await confirmBondReceipt(HASH, {
    waitForReceipt: async () => ({ status: 'reverted' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
    refetchAccount: async () => {
      synced = true;
      return successRefetch();
    },
  });
  assert.equal(outcome.kind, 'reverted');
  assert.equal(synced, false);
});

test('claim write flow uses claimBond and resume never rewrites', async () => {
  let writeCount = 0;
  let simulatedFn = '';
  let simulatedArgs: readonly unknown[] = [];

  const claim = await submitBondWriteFlow({
    refetchAccount: async () => successRefetch(),
    validateFreshAccount: () => true,
    simulate: async () => {
      simulatedFn = 'claimBond';
      simulatedArgs = [42n];
      return {
        address: sampleAccount.address,
        functionName: 'claimBond',
        args: [42n],
        account: sampleAccount.address,
      };
    },
    write: async (simulated) => {
      writeCount += 1;
      assert.equal(simulated.functionName, 'claimBond');
      assert.deepEqual(simulated.args, [42n]);
      return HASH;
    },
    waitForReceipt: async () => {
      throw new Error('browser RPC read failed');
    },
    confirmOnServer: async () => {
      throw new Error('server unavailable');
    },
  });

  assert.equal(claim.kind, 'confirmation_unavailable');
  assert.equal(simulatedFn, 'claimBond');
  assert.deepEqual(simulatedArgs, [42n]);
  assert.equal(writeCount, 1);

  // Resume confirmation only — never a second claim write.
  const resume = await confirmBondReceipt(HASH, {
    waitForReceipt: async () => ({ status: 'success' }),
    confirmOnServer: async () => ({ status: 'confirmed', source: 'server' }),
    refetchAccount: async () => successRefetch(),
  });
  assert.equal(resume.kind, 'confirmed');
  assert.equal(writeCount, 1);
});

test('accountFromSuccessfulRefetch stays strict for write gates', () => {
  assert.equal(accountFromSuccessfulRefetch(errorRefetch()), undefined);
  assert.deepEqual(
    accountFromSuccessfulRefetch(successRefetch(), sampleAccount.address),
    sampleAccount,
  );
});
