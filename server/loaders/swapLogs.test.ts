import assert from 'node:assert/strict';
import { test } from 'node:test';

import { logSwapTransactionEvent } from './swapLogs.ts';

test('swap transaction logs include sanitized server request metadata', () => {
  const originalInfo = console.info;
  let loggedLine = '';

  console.info = (message?: unknown) => {
    loggedLine = String(message);
  };

  try {
    logSwapTransactionEvent({
      event: 'swap_submitted',
      ownerAddress: '0x0000000000000000000000000000000000000001',
      tokenInSymbol: 'WBTC',
      tokenOutSymbol: 'PRANA',
      amountIn: '0.01',
    }, {
      clientIp: '127.0.0.1',
      requestHost: 'localhost:4174',
      requestOrigin: 'http://localhost:5173',
      userAgent: 'swap-log-test',
    });
  } finally {
    console.info = originalInfo;
  }

  const parsed = JSON.parse(loggedLine);
  assert.equal(parsed.scope, 'swap');
  assert.equal(parsed.event, 'transaction_event');
  assert.equal(parsed.clientIp, 'localhost');
  assert.equal(parsed.requestHost, 'localhost:4174');
  assert.equal(parsed.requestOrigin, 'http://localhost:5173');
  assert.equal(parsed.userAgent, 'swap-log-test');
});
