import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  mapBondTermOption,
  mapActiveBondRecords,
} from '../../../server/utils/bondingReadUtils.ts';

/** Larger than Number.MAX_SAFE_INTEGER — must survive as decimal string. */
const HUGE_ID = (BigInt(Number.MAX_SAFE_INTEGER) + 99n).toString();
const HUGE_AMOUNT = (BigInt(Number.MAX_SAFE_INTEGER) + 1_000_000n).toString();

test('mapActiveBondRecords keeps bond id and amounts as decimal strings', () => {
  const buyRecords = mapActiveBondRecords(
    [
      {
        id: BigInt(HUGE_ID),
        owner: '0x1111111111111111111111111111111111111111',
        wbtcAmount: BigInt(HUGE_AMOUNT),
        pranaAmount: 123456789012345678901n,
        maturityTime: 1_800_000_000n,
        creationTime: 1_700_000_000n,
        lastClaimTime: 1_700_000_100n,
        claimedPrana: 999999999999999999n,
        claimed: false,
      },
    ],
    'buy',
    'v2',
  );

  assert.equal(buyRecords.length, 1);
  const buy = buyRecords[0];
  assert.equal(typeof buy.id, 'string');
  assert.equal(buy.id, HUGE_ID);
  assert.equal(typeof buy.wbtcAmountRaw, 'string');
  assert.equal(buy.wbtcAmountRaw, HUGE_AMOUNT);
  assert.equal(buy.pranaAmountRaw, '123456789012345678901');
  assert.equal(buy.claimedRaw, '999999999999999999');
  assert.equal(buy.side, 'buy');
  assert.equal(buy.version, 'v2');

  // JSON round-trip must not coerce uint256 fields to number.
  const buyJson = JSON.parse(JSON.stringify(buy)) as typeof buy;
  assert.equal(buyJson.id, HUGE_ID);
  assert.equal(buyJson.wbtcAmountRaw, HUGE_AMOUNT);
  assert.equal(typeof buyJson.id, 'string');
  assert.equal(typeof buyJson.wbtcAmountRaw, 'string');
});

test('mapActiveBondRecords maps sell claimedWbtc into claimedRaw', () => {
  const sellRecords = mapActiveBondRecords(
    [
      {
        id: BigInt(HUGE_ID),
        owner: '0x2222222222222222222222222222222222222222',
        pranaAmount: BigInt(HUGE_AMOUNT),
        wbtcAmount: 88n,
        maturityTime: 2,
        creationTime: 1,
        lastClaimTime: 1,
        claimedWbtc: BigInt(HUGE_AMOUNT),
        claimed: true,
      },
    ],
    'sell',
    'v1',
  );

  assert.equal(sellRecords[0].claimedRaw, HUGE_AMOUNT);
  assert.equal(sellRecords[0].pranaAmountRaw, HUGE_AMOUNT);
  assert.equal(sellRecords[0].wbtcAmountRaw, '88');
  assert.equal(sellRecords[0].side, 'sell');
  assert.equal(sellRecords[0].version, 'v1');
  assert.equal(sellRecords[0].claimed, true);
});

test('mapBondTermOption keeps rate as decimal string above MAX_SAFE_INTEGER', () => {
  const term = mapBondTermOption(2, BigInt(HUGE_AMOUNT), 2_592_000n);
  assert.equal(term.termId, 2);
  assert.equal(term.rateBpsRaw, HUGE_AMOUNT);
  assert.equal(typeof term.rateBpsRaw, 'string');
  assert.equal(term.durationSeconds, 2_592_000);

  const json = JSON.parse(JSON.stringify(term)) as typeof term;
  assert.equal(json.rateBpsRaw, HUGE_AMOUNT);
  assert.equal(typeof json.rateBpsRaw, 'string');
});
