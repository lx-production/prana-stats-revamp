import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  logSwapTransactionEvent,
  parseSwapTransactionLogRequest,
} from '../loaders/swapLogs.ts';

function captureSwapLog(run: () => void): Record<string, unknown> {
  const originalInfo = console.info;
  let loggedLine = '';

  console.info = (message?: unknown) => {
    loggedLine = String(message);
  };

  try {
    run();
  } finally {
    console.info = originalInfo;
  }

  assert.ok(loggedLine, 'expected a swap log line');
  // Logs must stay single-line JSON so newline injection cannot split records
  assert.equal(loggedLine.includes('\n'), false);
  return JSON.parse(loggedLine) as Record<string, unknown>;
}

test('swap transaction logs include sanitized server request metadata', () => {
  const parsed = captureSwapLog(() => {
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
  });

  assert.equal(parsed.scope, 'swap');
  assert.equal(parsed.event, 'transaction_event');
  assert.equal(parsed.clientIp, 'localhost');
  assert.equal(parsed.requestHost, 'localhost:4174');
  assert.equal(parsed.requestOrigin, 'http://localhost:5173');
  assert.equal(parsed.userAgent, 'swap-log-test');
});

test('parseSwapTransactionLogRequest rejects trusted swap_confirmed events', () => {
  assert.throws(
    () => {
      parseSwapTransactionLogRequest({
        event: 'swap_confirmed',
        ownerAddress: '0x0000000000000000000000000000000000000001',
      });
    },
    /Invalid swap log event/,
  );
});

test('parseSwapTransactionLogRequest rejects unknown and verified-only event names', () => {
  assert.throws(
    () => parseSwapTransactionLogRequest({ event: 'transaction_event_verified' }),
    /Invalid swap log event/,
  );
  assert.throws(
    () => parseSwapTransactionLogRequest({ event: 'quote_route_selected' }),
    /Invalid swap log event/,
  );
  assert.throws(
    () => parseSwapTransactionLogRequest({}),
    /Invalid swap log event/,
  );
});

test('parseSwapTransactionLogRequest accepts untrusted browser telemetry events only', () => {
  for (const event of [
    'approval_submitted',
    'approval_confirmed',
    'approval_failed',
    'swap_submitted',
    'swap_failed',
  ] as const) {
    const parsed = parseSwapTransactionLogRequest({ event });
    assert.equal(parsed.event, event);
  }
});

test('browser payload cannot supply trusted request metadata fields', () => {
  const parsed = parseSwapTransactionLogRequest({
    event: 'swap_submitted',
    ownerAddress: '0x0000000000000000000000000000000000000001',
    // Spoofed fields that only the server may attach via log metadata
    clientIp: '203.0.113.50',
    requestHost: 'evil.test',
    requestOrigin: 'https://evil.test',
    userAgent: 'spoofed-agent',
  });

  assert.equal('clientIp' in parsed, false);
  assert.equal('requestHost' in parsed, false);
  assert.equal('requestOrigin' in parsed, false);
  assert.equal('userAgent' in parsed, false);

  const logged = captureSwapLog(() => {
    logSwapTransactionEvent(parsed, {
      clientIp: '198.51.100.10',
      requestHost: 'example.test',
      requestOrigin: 'https://example.test',
      userAgent: 'server-derived-agent',
    });
  });

  // Server-derived metadata wins; browser spoof fields never appear on the parsed payload
  assert.equal(logged.clientIp, '198.51.100.10');
  assert.equal(logged.requestHost, 'example.test');
  assert.equal(logged.requestOrigin, 'https://example.test');
  assert.equal(logged.userAgent, 'server-derived-agent');
  assert.equal(logged.swapEvent, 'swap_submitted');
});

test('generic swap logs without server metadata omit client identity fields', () => {
  const logged = captureSwapLog(() => {
    logSwapTransactionEvent({
      event: 'swap_failed',
      error: 'user rejected',
    });
  });

  assert.equal(logged.event, 'transaction_event');
  assert.equal(logged.swapEvent, 'swap_failed');
  assert.equal(logged.clientIp, undefined);
  assert.equal(logged.requestHost, undefined);
  assert.equal(logged.requestOrigin, undefined);
  assert.equal(logged.userAgent, undefined);
});

test('parseSwapTransactionLogRequest redacts URLs and Alchemy key segments from errors', () => {
  const withUrl = parseSwapTransactionLogRequest({
    event: 'swap_failed',
    error: 'RPC failed at https://polygon-mainnet.g.alchemy.com/v2/super-secret-key',
  });

  assert.equal(withUrl.error, 'RPC failed at [redacted-url]');
  assert.equal(withUrl.error?.includes('super-secret-key'), false);

  // Bare Alchemy path (no scheme) still redacts the key segment
  const withAlchemyPath = parseSwapTransactionLogRequest({
    event: 'swap_failed',
    error: 'provider alchemy.com/v2/super-secret-key timed out',
  });

  assert.equal(withAlchemyPath.error, 'provider alchemy.com/v2/[redacted] timed out');
});

test('parseSwapTransactionLogRequest truncates long error strings', () => {
  const parsed = parseSwapTransactionLogRequest({
    event: 'swap_failed',
    error: 'x'.repeat(1500),
  });

  assert.equal(parsed.error?.length, 1000);
});

test('logged error fields stay JSON-safe even with embedded newlines', () => {
  const parsed = parseSwapTransactionLogRequest({
    event: 'swap_failed',
    error: 'line1\nline2\r\nhttps://evil.test/leak',
  });

  const logged = captureSwapLog(() => {
    logSwapTransactionEvent(parsed);
  });

  assert.equal(logged.error, 'line1\nline2\r\n[redacted-url]');
  assert.equal(logged.swapEvent, 'swap_failed');
});
