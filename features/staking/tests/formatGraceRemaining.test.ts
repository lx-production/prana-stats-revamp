/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SECONDS_PER_DAY } from '../../../constants/network.ts';
import { formatGraceRemainingLabel } from '../utils/formatGraceRemaining.ts';

const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;

test('formatGraceRemainingLabel formats VI and EN with days/hours/minutes', () => {
  const remaining =
    6 * SECONDS_PER_DAY + 14 * SECONDS_PER_HOUR + 22 * SECONDS_PER_MINUTE;

  assert.equal(
    formatGraceRemainingLabel(remaining, 'vi'),
    '6 ngày 14 giờ 22 phút',
  );
  assert.equal(
    formatGraceRemainingLabel(remaining, 'en'),
    '6 days 14 hours 22 minutes',
  );
});

test('formatGraceRemainingLabel floors seconds and clamps negatives to zero', () => {
  assert.equal(
    formatGraceRemainingLabel(SECONDS_PER_MINUTE + 59, 'vi'),
    '0 ngày 0 giờ 1 phút',
  );
  assert.equal(formatGraceRemainingLabel(-10, 'en'), '0 days 0 hours 0 minutes');
});
