/// <reference types="node" />
/**
 * Characterization tests for compact wallet address formatting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactAddress } from '../../features/web3/walletFormatting.ts';

test('formatCompactAddress keeps 0x prefix + 4 hex, then ... then last 4', () => {
  assert.equal(
    formatCompactAddress('0x1234567890abcdef1234567890abcdef12345678'),
    '0x1234...5678',
  );
  assert.equal(formatCompactAddress('0xABCDEF'), '0xABCD...CDEF');
});
