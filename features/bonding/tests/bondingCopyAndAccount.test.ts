/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBondingCopy } from '../bonding.copy.ts';
import { accountFromSuccessfulRefetch } from '../accountRefetch.ts';
import { sortActiveBonds } from '../bondingMath.ts';

import type { ActiveBondRecord, BondingAccount } from '../bonding.types.ts';

test('getBondingCopy exposes matching VI/EN keys for all three quote modes', () => {
  const vi = getBondingCopy('vi');
  const en = getBondingCopy('en');

  const viKeys = Object.keys(vi).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(viKeys, enKeys);

  // Mode-specific copy must exist in both locales.
  for (const key of [
    'buyExactWbtcMode',
    'buyTargetPranaMode',
    'expectedPrana',
    'expectedWbtc',
    'requiredWbtc',
    'targetPranaNoMaxInWarning',
    'quoteIssues',
    'amountReasons',
  ] as const) {
    assert.ok(vi[key], `missing VI ${key}`);
    assert.ok(en[key], `missing EN ${key}`);
  }

  assert.notEqual(vi.buyTab, en.buyTab);
  assert.notEqual(vi.quoteEmpty, en.quoteEmpty);
  assert.equal(typeof vi.durationLabel(30), 'string');
  assert.equal(typeof en.durationLabel(30), 'string');
});

test('accountFromSuccessfulRefetch rejects cache-like failures and address mismatch', () => {
  const account: BondingAccount = {
    address: '0x1111111111111111111111111111111111111111',
    blockNumber: 1,
    blockTimestamp: 1,
    pranaBalanceRaw: '0',
    wbtcBalanceRaw: '0',
    buyV2WbtcAllowanceRaw: '0',
    sellV2PranaAllowanceRaw: '0',
    bonds: [],
  };

  assert.equal(accountFromSuccessfulRefetch(null), undefined);
  assert.equal(
    accountFromSuccessfulRefetch({ status: 'error', error: new Error('x') }),
    undefined,
  );
  assert.equal(
    accountFromSuccessfulRefetch({ isSuccess: true, data: undefined }),
    undefined,
  );
  assert.equal(
    accountFromSuccessfulRefetch(
      { isSuccess: true, data: account },
      '0x2222222222222222222222222222222222222222',
    ),
    undefined,
  );
  assert.equal(
    accountFromSuccessfulRefetch(
      { isSuccess: true, data: account },
      '0x1111111111111111111111111111111111111111',
    ),
    account,
  );
});

test('sortActiveBonds orders by maturity then side/version/id', () => {
  const bonds: ActiveBondRecord[] = [
    {
      id: '2',
      side: 'sell',
      version: 'v2',
      owner: '0x1111111111111111111111111111111111111111',
      wbtcAmountRaw: '1',
      pranaAmountRaw: '1',
      maturityTime: 200,
      creationTime: 100,
      lastClaimTime: 100,
      claimedRaw: '0',
      claimed: false,
    },
    {
      id: '1',
      side: 'buy',
      version: 'v1',
      owner: '0x1111111111111111111111111111111111111111',
      wbtcAmountRaw: '1',
      pranaAmountRaw: '1',
      maturityTime: 100,
      creationTime: 50,
      lastClaimTime: 50,
      claimedRaw: '0',
      claimed: false,
    },
    {
      id: '9',
      side: 'buy',
      version: 'v2',
      owner: '0x1111111111111111111111111111111111111111',
      wbtcAmountRaw: '1',
      pranaAmountRaw: '1',
      maturityTime: 100,
      creationTime: 50,
      lastClaimTime: 50,
      claimedRaw: '0',
      claimed: false,
    },
  ];

  const sorted = sortActiveBonds(bonds);
  assert.deepEqual(
    sorted.map((b) => `${b.side}-${b.version}-${b.id}`),
    ['buy-v1-1', 'buy-v2-9', 'sell-v2-2'],
  );
});
