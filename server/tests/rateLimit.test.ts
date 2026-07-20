import type { IncomingMessage } from 'node:http';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createSwapRateLimiters } from '../rateLimit.ts';

const ORIGINAL_TRUSTED_PROXY_HOP_COUNT = process.env.TRUSTED_PROXY_HOP_COUNT;

afterEach(() => {
  restoreEnv('TRUSTED_PROXY_HOP_COUNT', ORIGINAL_TRUSTED_PROXY_HOP_COUNT);
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function mockRequest(
  remoteAddress: string,
  forwardedFor?: string | string[],
): IncomingMessage {
  return {
    headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor },
    socket: { remoteAddress },
  } as IncomingMessage;
}

function spendQuoteBudget(
  limiter: ReturnType<typeof createSwapRateLimiters>,
  req: IncomingMessage,
  count = 5,
): void {
  for (let index = 0; index < count; index += 1) {
    assert.equal(limiter.isSwapQuoteRateLimited(req), false);
  }
}

function spendLogBudget(
  limiter: ReturnType<typeof createSwapRateLimiters>,
  req: IncomingMessage,
  count = 30,
): void {
  for (let index = 0; index < count; index += 1) {
    assert.equal(limiter.isSwapLogRateLimited(req), false);
  }
}

function spendVerifyBudget(
  limiter: ReturnType<typeof createSwapRateLimiters>,
  req: IncomingMessage,
  count = 10,
): void {
  for (let index = 0; index < count; index += 1) {
    assert.equal(limiter.isSwapVerifyRateLimited(req), false);
  }
}

test('direct untrusted sockets ignore spoofed X-Forwarded-For values', () => {
  const limiter = createSwapRateLimiters();

  for (let index = 0; index < 5; index += 1) {
    assert.equal(
      limiter.isSwapQuoteRateLimited(mockRequest('203.0.113.10', `198.51.100.${index}`)),
      false,
    );
  }

  assert.equal(
    limiter.isSwapQuoteRateLimited(mockRequest('203.0.113.10', '198.51.100.250')),
    true,
  );
});

test('default trusted proxy hop count keeps single-proxy last-entry behavior', () => {
  delete process.env.TRUSTED_PROXY_HOP_COUNT;
  const limiter = createSwapRateLimiters();

  spendQuoteBudget(limiter, mockRequest('127.0.0.1', '198.51.100.10, 127.0.0.1'));

  assert.equal(
    limiter.isSwapQuoteRateLimited(mockRequest('127.0.0.1', '198.51.100.11, 127.0.0.1')),
    true,
  );
});

test('two-hop trusted proxy count selects the real client before the Pi hop', () => {
  process.env.TRUSTED_PROXY_HOP_COUNT = '2';
  const limiter = createSwapRateLimiters();

  spendQuoteBudget(limiter, mockRequest('127.0.0.1', '198.51.100.20, 127.0.0.1'));

  assert.equal(
    limiter.isSwapQuoteRateLimited(mockRequest('127.0.0.1', '198.51.100.20, 127.0.0.1')),
    true,
  );
  assert.equal(
    limiter.isSwapQuoteRateLimited(mockRequest('127.0.0.1', '198.51.100.21, 127.0.0.1')),
    false,
  );
});

test('two-hop trusted proxy count is stable when a client prepends spoofed XFF data', () => {
  process.env.TRUSTED_PROXY_HOP_COUNT = '2';
  const limiter = createSwapRateLimiters();

  spendQuoteBudget(
    limiter,
    mockRequest('127.0.0.1', '192.0.2.250, 198.51.100.30, 127.0.0.1'),
  );

  assert.equal(
    limiter.isSwapQuoteRateLimited(
      mockRequest('127.0.0.1', '192.0.2.251, 198.51.100.30, 127.0.0.1'),
    ),
    true,
  );
  assert.equal(
    limiter.isSwapQuoteRateLimited(
      mockRequest('127.0.0.1', '192.0.2.250, 198.51.100.31, 127.0.0.1'),
    ),
    false,
  );
});

test('different real clients behind the two-hop deployment do not share the quote bucket', () => {
  process.env.TRUSTED_PROXY_HOP_COUNT = '2';
  const limiter = createSwapRateLimiters();

  spendQuoteBudget(limiter, mockRequest('127.0.0.1', '198.51.100.40, 127.0.0.1'));

  assert.equal(
    limiter.isSwapQuoteRateLimited(mockRequest('127.0.0.1', '198.51.100.41, 127.0.0.1')),
    false,
  );
});

test('swap quote limiter has a global all-clients budget', () => {
  const limiter = createSwapRateLimiters();

  for (let index = 0; index < 30; index += 1) {
    assert.equal(
      limiter.isSwapQuoteRateLimited(mockRequest(`198.51.100.${index}`)),
      false,
    );
  }

  assert.equal(
    limiter.isSwapQuoteRateLimited(mockRequest('203.0.113.61')),
    true,
  );
});

test('per-IP quote rejections do not spend the global quote budget', () => {
  const limiter = createSwapRateLimiters();

  spendQuoteBudget(limiter, mockRequest('198.51.100.80'));
  assert.equal(limiter.isSwapQuoteRateLimited(mockRequest('198.51.100.80')), true);

  for (let index = 0; index < 25; index += 1) {
    assert.equal(
      limiter.isSwapQuoteRateLimited(mockRequest(`203.0.113.${index}`)),
      false,
    );
  }

  assert.equal(
    limiter.isSwapQuoteRateLimited(mockRequest('203.0.113.60')),
    true,
  );
});

test('invalid trusted proxy hop counts fall back to single-proxy behavior', () => {
  process.env.TRUSTED_PROXY_HOP_COUNT = 'many';
  const limiter = createSwapRateLimiters();

  spendQuoteBudget(limiter, mockRequest('127.0.0.1', '198.51.100.50, 127.0.0.1'));

  assert.equal(
    limiter.isSwapQuoteRateLimited(mockRequest('127.0.0.1', '198.51.100.51, 127.0.0.1')),
    true,
  );
});

test('swap verification has an independent 10 request per minute bucket', () => {
  const limiter = createSwapRateLimiters();
  const req = mockRequest('198.51.100.60');

  spendVerifyBudget(limiter, req);

  assert.equal(limiter.isSwapVerifyRateLimited(req), true);
  assert.equal(limiter.isSwapLogRateLimited(req), false);
});

test('spending the swap log budget does not spend the verification budget', () => {
  const limiter = createSwapRateLimiters();
  const req = mockRequest('198.51.100.61');

  spendLogBudget(limiter, req);

  assert.equal(limiter.isSwapLogRateLimited(req), true);
  assert.equal(limiter.isSwapVerifyRateLimited(req), false);
});

test('verification limiter uses the same trusted proxy client identity logic', () => {
  process.env.TRUSTED_PROXY_HOP_COUNT = '2';
  const limiter = createSwapRateLimiters();

  spendVerifyBudget(limiter, mockRequest('127.0.0.1', '198.51.100.70, 127.0.0.1'));

  assert.equal(
    limiter.isSwapVerifyRateLimited(mockRequest('127.0.0.1', '198.51.100.70, 127.0.0.1')),
    true,
  );
  assert.equal(
    limiter.isSwapVerifyRateLimited(mockRequest('127.0.0.1', '198.51.100.71, 127.0.0.1')),
    false,
  );
});

test('getClientIp returns normalized direct socket addresses', () => {
  const limiter = createSwapRateLimiters();

  assert.equal(limiter.getClientIp(mockRequest('::ffff:198.51.100.90')), '198.51.100.90');
  assert.equal(limiter.getClientIp(mockRequest('127.0.0.1')), '127.0.0.1');
});

test('getClientIp uses the same trusted proxy hop logic as rate limits', () => {
  process.env.TRUSTED_PROXY_HOP_COUNT = '2';
  const limiter = createSwapRateLimiters();

  assert.equal(
    limiter.getClientIp(mockRequest('127.0.0.1', '192.0.2.250, 198.51.100.91, 127.0.0.1')),
    '198.51.100.91',
  );
});

function spendStakingAccountBudget(
  limiter: ReturnType<typeof createSwapRateLimiters>,
  req: IncomingMessage,
  count = 30,
): void {
  for (let index = 0; index < count; index += 1) {
    assert.equal(limiter.isStakingAccountRateLimited(req), false);
  }
}

test('staking account limiter enforces 30 requests per IP per minute', () => {
  const limiter = createSwapRateLimiters();

  spendStakingAccountBudget(limiter, mockRequest('198.51.100.120'));
  assert.equal(limiter.isStakingAccountRateLimited(mockRequest('198.51.100.120')), true);
  assert.equal(limiter.isStakingAccountRateLimited(mockRequest('198.51.100.121')), false);
});

test('staking account limiter has a global all-clients budget of 120', () => {
  const limiter = createSwapRateLimiters();

  for (let index = 0; index < 120; index += 1) {
    assert.equal(
      limiter.isStakingAccountRateLimited(mockRequest(`203.0.113.${index % 200}`)),
      false,
    );
  }

  assert.equal(
    limiter.isStakingAccountRateLimited(mockRequest('198.51.100.200')),
    true,
  );
});

test('per-IP staking account rejections do not spend the global account budget', () => {
  const limiter = createSwapRateLimiters();

  spendStakingAccountBudget(limiter, mockRequest('198.51.100.130'));
  assert.equal(limiter.isStakingAccountRateLimited(mockRequest('198.51.100.130')), true);

  for (let index = 0; index < 90; index += 1) {
    assert.equal(
      limiter.isStakingAccountRateLimited(mockRequest(`203.0.113.${index}`)),
      false,
    );
  }

  assert.equal(
    limiter.isStakingAccountRateLimited(mockRequest('203.0.113.200')),
    true,
  );
});
