import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSwapRateLimiters } from '../rateLimit.ts';
import { createGetApiRouteHandler } from '../getApiRoutes.ts';
import { parseChecksumAddress } from '../helpers/addressHelpers.ts';
import { mapDurationOptions, mapStakeRecords } from '../utils/stakingReadUtils.ts';
import {
  INTEREST_CONTRACT_ADDRESS,
  PRANA_PERMIT_DOMAIN_NAME,
  PRANA_PERMIT_DOMAIN_VERSION,
  STAKING_CONTRACT_ADDRESS,
} from '../../constants/stakingContracts.ts';
import { PRANA_ADDRESS } from '../../constants/sharedContracts.ts';
import { POLYGON_CHAIN_ID, SECONDS_PER_DAY } from '../../constants/network.ts';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Address } from '../../types/blockchain.types.ts';
import type { StakingAccountSnapshot, StakingConfig } from '../../features/staking/staking.types.ts';

type MockHeaderValue = number | string | string[];

type MockResponse = ServerResponse & {
  headers: Map<string, MockHeaderValue>;
  body: string;
};

const SAMPLE_ADDRESS = '0x0000000000000000000000000000000000000001' as Address;
const SAMPLE_ADDRESS_LOWER = '0x0000000000000000000000000000000000000001';

function isStringArray(value: number | string | readonly string[]): value is readonly string[] {
  return Array.isArray(value);
}

function mockResponse(): MockResponse {
  const headers = new Map<string, MockHeaderValue>();

  return {
    headers,
    body: '',
    statusCode: 200,
    setHeader(name: string, value: number | string | readonly string[]) {
      headers.set(name, isStringArray(value) ? [...value] : value);
      return this as ServerResponse;
    },
    end(chunk?: unknown) {
      this.body = typeof chunk === 'string' ? chunk : String(chunk ?? '');
      return this as ServerResponse;
    },
  } as MockResponse;
}

function mockRequest(
  remoteAddress = '203.0.113.10',
  method = 'GET',
): IncomingMessage {
  return {
    method,
    headers: {},
    socket: { remoteAddress },
  } as IncomingMessage;
}

function parsedBody(res: MockResponse): Record<string, unknown> {
  return JSON.parse(res.body) as Record<string, unknown>;
}

function sampleConfig(): StakingConfig {
  return {
    chainId: POLYGON_CHAIN_ID,
    blockNumber: 12_345,
    blockTimestamp: 1_700_000_000,
    paused: false,
    minStakeRaw: '100000000000',
    gracePeriodSeconds: 7 * SECONDS_PER_DAY,
    earlyUnstakePenaltyPercent: 10,
    durations: [{ seconds: SECONDS_PER_DAY, days: 1, apr: 7 }],
    contracts: {
      prana: PRANA_ADDRESS,
      staking: STAKING_CONTRACT_ADDRESS,
      interest: INTEREST_CONTRACT_ADDRESS,
    },
    permitDomain: {
      name: PRANA_PERMIT_DOMAIN_NAME,
      version: PRANA_PERMIT_DOMAIN_VERSION,
    },
  };
}

function sampleAccount(address: Address): StakingAccountSnapshot {
  return {
    address,
    blockNumber: 12_345,
    blockTimestamp: 1_700_000_000,
    balanceRaw: '500000000000',
    permitNonce: '3',
    stakes: [
      {
        id: 1,
        amountRaw: '100000000000',
        startTime: 1_700_000_000,
        durationSeconds: SECONDS_PER_DAY * 30,
        apr: 9,
        lastClaimTime: 1_700_000_000,
      },
    ],
  };
}

test('parseChecksumAddress accepts valid addresses and rejects invalid input', () => {
  assert.equal(parseChecksumAddress(SAMPLE_ADDRESS_LOWER), SAMPLE_ADDRESS);
  assert.equal(parseChecksumAddress('not-an-address'), null);
  assert.equal(parseChecksumAddress(null), null);
  assert.equal(parseChecksumAddress(''), null);
});

test('mapDurationOptions builds days from SECONDS_PER_DAY and skips invalid rows', () => {
  assert.deepEqual(
    mapDurationOptions([SECONDS_PER_DAY, 0, SECONDS_PER_DAY * 7], [7, 8, 8]),
    [
      { seconds: SECONDS_PER_DAY, days: 1, apr: 7 },
      { seconds: SECONDS_PER_DAY * 7, days: 7, apr: 8 },
    ],
  );
});

test('mapStakeRecords serializes amounts as decimal strings not numbers', () => {
  const records = mapStakeRecords([
    {
      id: 42n,
      amount: 100000000000n,
      startTime: 1_700_000_000n,
      duration: BigInt(SECONDS_PER_DAY * 30),
      apr: 9,
      lastClaimTime: 1_700_000_000n,
    },
  ]);

  assert.deepEqual(records, [
    {
      id: 42,
      amountRaw: '100000000000',
      startTime: 1_700_000_000,
      durationSeconds: SECONDS_PER_DAY * 30,
      apr: 9,
      lastClaimTime: 1_700_000_000,
    },
  ]);
  assert.equal(typeof records[0].amountRaw, 'string');
});

test('GET /api/staking/config returns config with 30s private cache', async () => {
  const rateLimiters = createSwapRateLimiters();
  const handleGet = createGetApiRouteHandler(rateLimiters, {
    loadConfig: async () => sampleConfig(),
    loadAccount: async (address) => sampleAccount(address),
  });

  const res = mockResponse();
  const handled = await handleGet(
    mockRequest(),
    res,
    new URL('http://127.0.0.1/api/staking/config'),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('Cache-Control'), 'private, max-age=30');
  assert.deepEqual(parsedBody(res), sampleConfig());
});

test('GET /api/staking/config returns generic 502 without upstream details', async () => {
  const rateLimiters = createSwapRateLimiters();
  const handleGet = createGetApiRouteHandler(rateLimiters, {
    loadConfig: async () => {
      throw new Error('Alchemy https://eth-mainnet.g.alchemy.com/v2/SECRET_KEY failed');
    },
    loadAccount: async (address) => sampleAccount(address),
  });

  const res = mockResponse();
  await handleGet(mockRequest(), res, new URL('http://127.0.0.1/api/staking/config'));

  assert.equal(res.statusCode, 502);
  const body = parsedBody(res);
  assert.equal(body.error, 'upstream_unavailable');
  assert.equal(body.message, 'Failed to load staking config.');
  assert.equal(JSON.stringify(body).includes('SECRET_KEY'), false);
  assert.equal(JSON.stringify(body).includes('alchemy'), false);
});

test('GET /api/staking/account requires a valid address', async () => {
  const rateLimiters = createSwapRateLimiters();
  const handleGet = createGetApiRouteHandler(rateLimiters, {
    loadConfig: async () => sampleConfig(),
    loadAccount: async (address) => sampleAccount(address),
  });

  const missing = mockResponse();
  await handleGet(mockRequest(), missing, new URL('http://127.0.0.1/api/staking/account'));
  assert.equal(missing.statusCode, 400);
  assert.equal(parsedBody(missing).error, 'invalid_address');

  const invalid = mockResponse();
  await handleGet(
    mockRequest(),
    invalid,
    new URL('http://127.0.0.1/api/staking/account?address=0x123'),
  );
  assert.equal(invalid.statusCode, 400);
  assert.equal(parsedBody(invalid).error, 'invalid_address');
});

test('GET /api/staking/account checksums address and uses private no-store', async () => {
  const rateLimiters = createSwapRateLimiters();
  let seenAddress: Address | null = null;
  const handleGet = createGetApiRouteHandler(rateLimiters, {
    loadConfig: async () => sampleConfig(),
    loadAccount: async (address) => {
      seenAddress = address;
      return sampleAccount(address);
    },
  });

  const res = mockResponse();
  const handled = await handleGet(
    mockRequest(),
    res,
    new URL(`http://127.0.0.1/api/staking/account?address=${SAMPLE_ADDRESS_LOWER}`),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(seenAddress, SAMPLE_ADDRESS);
  assert.deepEqual(parsedBody(res), sampleAccount(SAMPLE_ADDRESS));
});

test('GET /api/staking/account returns generic 502 without upstream details', async () => {
  const rateLimiters = createSwapRateLimiters();
  const handleGet = createGetApiRouteHandler(rateLimiters, {
    loadConfig: async () => sampleConfig(),
    loadAccount: async () => {
      throw new Error('provider POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/KEY boom');
    },
  });

  const res = mockResponse();
  await handleGet(
    mockRequest(),
    res,
    new URL(`http://127.0.0.1/api/staking/account?address=${SAMPLE_ADDRESS}`),
  );

  assert.equal(res.statusCode, 502);
  const body = parsedBody(res);
  assert.equal(body.error, 'upstream_unavailable');
  assert.equal(body.message, 'Failed to load staking account.');
  assert.equal(JSON.stringify(body).includes('alchemy'), false);
  assert.equal(JSON.stringify(body).includes('KEY'), false);
});

test('GET /api/staking/account returns 429 when rate limited', async () => {
  const rateLimiters = createSwapRateLimiters();
  const handleGet = createGetApiRouteHandler(rateLimiters, {
    loadConfig: async () => sampleConfig(),
    loadAccount: async (address) => sampleAccount(address),
  });

  const req = mockRequest('198.51.100.50');
  for (let index = 0; index < 30; index += 1) {
    const ok = mockResponse();
    await handleGet(
      req,
      ok,
      new URL(`http://127.0.0.1/api/staking/account?address=${SAMPLE_ADDRESS}`),
    );
    assert.equal(ok.statusCode, 200);
  }

  const limited = mockResponse();
  await handleGet(
    req,
    limited,
    new URL(`http://127.0.0.1/api/staking/account?address=${SAMPLE_ADDRESS}`),
  );
  assert.equal(limited.statusCode, 429);
  assert.equal(parsedBody(limited).error, 'rate_limited');
});

test('invalid staking account addresses do not spend rate-limit quota', async () => {
  const rateLimiters = createSwapRateLimiters();
  const handleGet = createGetApiRouteHandler(rateLimiters, {
    loadConfig: async () => sampleConfig(),
    loadAccount: async (address) => sampleAccount(address),
  });

  // 120 junk requests from many IPs would exhaust the global budget if rate-limited first.
  for (let index = 0; index < 120; index += 1) {
    const junk = mockResponse();
    await handleGet(
      mockRequest(`203.0.113.${index}`),
      junk,
      new URL('http://127.0.0.1/api/staking/account?address=not-an-address'),
    );
    assert.equal(junk.statusCode, 400);
  }

  const ok = mockResponse();
  await handleGet(
    mockRequest('198.51.100.77'),
    ok,
    new URL(`http://127.0.0.1/api/staking/account?address=${SAMPLE_ADDRESS}`),
  );
  assert.equal(ok.statusCode, 200);
});

test('staking config/account reject non-GET with 405 and Allow: GET', async () => {
  const rateLimiters = createSwapRateLimiters();
  const handleGet = createGetApiRouteHandler(rateLimiters, {
    loadConfig: async () => sampleConfig(),
    loadAccount: async (address) => sampleAccount(address),
  });

  const configRes = mockResponse();
  await handleGet(
    mockRequest('203.0.113.10', 'POST'),
    configRes,
    new URL('http://127.0.0.1/api/staking/config'),
  );
  assert.equal(configRes.statusCode, 405);
  assert.equal(configRes.headers.get('Allow'), 'GET');
  assert.equal(parsedBody(configRes).error, 'method_not_allowed');

  const accountRes = mockResponse();
  await handleGet(
    mockRequest('203.0.113.10', 'POST'),
    accountRes,
    new URL(`http://127.0.0.1/api/staking/account?address=${SAMPLE_ADDRESS}`),
  );
  assert.equal(accountRes.statusCode, 405);
  assert.equal(accountRes.headers.get('Allow'), 'GET');
  assert.equal(parsedBody(accountRes).error, 'method_not_allowed');
});

test('staking upstream failures log redacted errors without RPC secrets', async () => {
  const rateLimiters = createSwapRateLimiters();
  const handleGet = createGetApiRouteHandler(rateLimiters, {
    loadConfig: async () => {
      throw new Error('Alchemy https://polygon-mainnet.g.alchemy.com/v2/SECRET_KEY_ABC failed');
    },
    loadAccount: async () => {
      throw new Error('provider alchemy.com/v2/SECRET_KEY_XYZ timed out');
    },
  });

  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  };

  try {
    const configRes = mockResponse();
    await handleGet(mockRequest(), configRes, new URL('http://127.0.0.1/api/staking/config'));
    assert.equal(configRes.statusCode, 502);

    const accountRes = mockResponse();
    await handleGet(
      mockRequest(),
      accountRes,
      new URL(`http://127.0.0.1/api/staking/account?address=${SAMPLE_ADDRESS}`),
    );
    assert.equal(accountRes.statusCode, 502);
  } finally {
    console.error = originalError;
  }

  const combined = logged.join('\n');
  assert.match(combined, /Failed to load staking config:/);
  assert.match(combined, /Failed to load staking account:/);
  assert.match(combined, /\[redacted-url\]|alchemy\.com\/v2\/\[redacted\]/);
  assert.equal(combined.includes('SECRET_KEY'), false);
  assert.equal(combined.includes('https://polygon-mainnet'), false);
});
