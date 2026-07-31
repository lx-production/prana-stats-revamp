import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSwapRateLimiters } from '../rateLimit.ts';
import { createGetApiRouteHandler } from '../getApiRoutes.ts';
import { createPostApiRouteHandler } from '../postApiRoutes.ts';
import { parseChecksumAddress } from '../helpers/addressHelpers.ts';
import {
  buildExpectedCall,
  confirmBondingTransaction,
} from '../loaders/bondingTransactionConfirmation.ts';
import {
  BondingApiValidationError,
  computeBondingQuote,
  mapActiveBondRecords,
  mergeActiveBondRecords,
  mulDiv,
  MAX_UINT256,
  MAX_UINT256_DECIMAL_DIGITS,
  parseBondingConfirmationRequest,
  parseBondingQuoteRequest,
  parseUnsignedDecimalRaw,
} from '../utils/bondingReadUtils.ts';
import {
  BUY_BOND_ADDRESS_V1,
  BUY_BOND_ADDRESS_V2,
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ADDRESS_V2,
} from '../../constants/bonds.ts';
import {
  PRANA_ADDRESS,
  WBTC_ADDRESS,
  PRANA_DECIMALS,
  WBTC_DECIMALS,
  WBTC_PRANA_V3_POOL,
} from '../../constants/sharedContracts.ts';
import { POLYGON_CHAIN_ID, SECONDS_PER_DAY } from '../../constants/network.ts';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Address, Hex } from '../../types/blockchain.types.ts';
import type {
  BondingAccount,
  BondingConfig,
  BondingQuote,
  BondingTransactionConfirmation,
} from '../../features/bonding/bonding.types.ts';

type MockHeaderValue = number | string | string[];

type MockResponse = ServerResponse & {
  headers: Map<string, MockHeaderValue>;
  body: string;
};

const SAMPLE_ADDRESS = '0x0000000000000000000000000000000000000001' as Address;
const SAMPLE_ADDRESS_LOWER = '0x0000000000000000000000000000000000000001';
const SAMPLE_TX_HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;

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
  headers: Record<string, string | string[] | undefined> = {},
): IncomingMessage {
  return {
    method,
    headers,
    socket: { remoteAddress },
  } as IncomingMessage;
}

function mockBodyRequest(
  chunks: Array<string | Buffer>,
  headers: Record<string, string | string[] | undefined> = {
    'content-type': 'application/json',
    host: '127.0.0.1',
  },
  remoteAddress = '203.0.113.10',
): IncomingMessage {
  return {
    method: 'POST',
    headers,
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as IncomingMessage;
}

function parsedBody(res: MockResponse): Record<string, unknown> {
  return JSON.parse(res.body) as Record<string, unknown>;
}

function sampleConfig(): BondingConfig {
  return {
    chainId: POLYGON_CHAIN_ID,
    blockNumber: 12_345,
    blockTimestamp: 1_700_000_000,
    paused: {
      buyV1: false,
      buyV2: false,
      sellV1: true,
      sellV2: false,
    },
    minBuyPranaRaw: '1000000000',
    minSellPranaRaw: '2000000000',
    buyTerms: [
      { termId: 0, rateBpsRaw: '500', durationSeconds: SECONDS_PER_DAY * 7 },
      { termId: 1, rateBpsRaw: '1000', durationSeconds: SECONDS_PER_DAY * 30 },
      { termId: 2, rateBpsRaw: '1500', durationSeconds: SECONDS_PER_DAY * 90 },
      { termId: 3, rateBpsRaw: '2000', durationSeconds: SECONDS_PER_DAY * 180 },
      { termId: 4, rateBpsRaw: '2500', durationSeconds: SECONDS_PER_DAY * 365 },
    ],
    sellTerms: [
      { termId: 0, rateBpsRaw: '400', durationSeconds: SECONDS_PER_DAY * 7 },
      { termId: 1, rateBpsRaw: '800', durationSeconds: SECONDS_PER_DAY * 30 },
      { termId: 2, rateBpsRaw: '1200', durationSeconds: SECONDS_PER_DAY * 90 },
      { termId: 3, rateBpsRaw: '1600', durationSeconds: SECONDS_PER_DAY * 180 },
      { termId: 4, rateBpsRaw: '2000', durationSeconds: SECONDS_PER_DAY * 365 },
    ],
    contracts: {
      buyV1: BUY_BOND_ADDRESS_V1,
      buyV2: BUY_BOND_ADDRESS_V2,
      sellV1: SELL_BOND_ADDRESS_V1,
      sellV2: SELL_BOND_ADDRESS_V2,
      prana: PRANA_ADDRESS,
      wbtc: WBTC_ADDRESS,
      pool: WBTC_PRANA_V3_POOL,
    },
    pranaDecimals: PRANA_DECIMALS,
    wbtcDecimals: WBTC_DECIMALS,
  };
}

function sampleAccount(address: Address): BondingAccount {
  return {
    address,
    blockNumber: 12_345,
    blockTimestamp: 1_700_000_000,
    pranaBalanceRaw: '500000000000',
    wbtcBalanceRaw: '100000000',
    buyV2WbtcAllowanceRaw: '0',
    sellV2PranaAllowanceRaw: '0',
    bonds: [
      {
        id: '1',
        side: 'buy',
        version: 'v2',
        owner: address,
        wbtcAmountRaw: '1000',
        pranaAmountRaw: '2000000000',
        maturityTime: 1_800_000_000,
        creationTime: 1_700_000_000,
        lastClaimTime: 1_700_000_000,
        claimedRaw: '0',
        claimed: false,
      },
    ],
  };
}

function sampleQuote(): BondingQuote {
  return {
    mode: 'buy_exact_wbtc',
    termId: 1,
    wbtcAmountRaw: '100000',
    pranaAmountRaw: '9000000000',
    rateBpsRaw: '1000',
    durationSeconds: SECONDS_PER_DAY * 30,
    blockNumber: 12_345,
    blockTimestamp: 1_700_000_000,
    reserveSource: 'impacted',
    issues: [],
  };
}

function createHandlers(options?: {
  loadConfig?: () => Promise<BondingConfig>;
  loadAccount?: (address: Address) => Promise<BondingAccount>;
  loadQuote?: () => Promise<BondingQuote>;
  confirmTransaction?: () => Promise<BondingTransactionConfirmation>;
  quoteCalls?: { count: number };
}) {
  const rateLimiters = createSwapRateLimiters();
  const quoteCalls = options?.quoteCalls ?? { count: 0 };

  const handleGet = createGetApiRouteHandler(
    rateLimiters,
    {
      loadConfig: async () => {
        throw new Error('staking config unused');
      },
      loadAccount: async () => {
        throw new Error('staking account unused');
      },
    },
    {
      loadConfig: options?.loadConfig ?? (async () => sampleConfig()),
      loadAccount:
        options?.loadAccount ?? (async (address) => sampleAccount(address)),
    },
  );

  const handlePost = createPostApiRouteHandler(rateLimiters, {
    bonding: {
      loadQuote: async (request) => {
        quoteCalls.count += 1;
        if (options?.loadQuote) return options.loadQuote();
        return { ...sampleQuote(), mode: request.mode, termId: request.termId };
      },
      confirmTransaction:
        options?.confirmTransaction ??
        (async () => ({ status: 'confirmed', source: 'server' })),
    },
  });

  return { rateLimiters, handleGet, handlePost, quoteCalls };
}

// ---------------------------------------------------------------------------
// Config / account GET routes
// ---------------------------------------------------------------------------

test('GET /api/bonding/config returns config with 30s private cache', async () => {
  const { handleGet } = createHandlers();
  const res = mockResponse();
  const handled = await handleGet(
    mockRequest(),
    res,
    new URL('http://127.0.0.1/api/bonding/config'),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('Cache-Control'), 'private, max-age=30');
  assert.deepEqual(parsedBody(res), sampleConfig());
});

test('GET /api/bonding/config rejects non-GET with 405', async () => {
  const { handleGet } = createHandlers();
  const res = mockResponse();
  await handleGet(
    mockRequest('203.0.113.10', 'POST'),
    res,
    new URL('http://127.0.0.1/api/bonding/config'),
  );
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.get('Allow'), 'GET');
});

test('GET /api/bonding/config returns generic 502 without upstream details', async () => {
  const { handleGet } = createHandlers({
    loadConfig: async () => {
      throw new Error('Alchemy https://polygon-mainnet.g.alchemy.com/v2/SECRET_KEY failed');
    },
  });

  const res = mockResponse();
  await handleGet(mockRequest(), res, new URL('http://127.0.0.1/api/bonding/config'));

  assert.equal(res.statusCode, 502);
  const body = parsedBody(res);
  assert.equal(body.error, 'upstream_unavailable');
  assert.equal(JSON.stringify(body).includes('SECRET_KEY'), false);
  assert.equal(JSON.stringify(body).includes('alchemy'), false);
});

test('GET /api/bonding/account requires a valid address before rate-limit', async () => {
  const { handleGet, rateLimiters } = createHandlers();

  const missing = mockResponse();
  await handleGet(mockRequest(), missing, new URL('http://127.0.0.1/api/bonding/account'));
  assert.equal(missing.statusCode, 400);
  assert.equal(parsedBody(missing).error, 'invalid_address');

  // Junk must not burn quota — fill would-be global budget with junk then succeed.
  for (let index = 0; index < 120; index += 1) {
    const junk = mockResponse();
    await handleGet(
      mockRequest(`203.0.113.${index}`),
      junk,
      new URL('http://127.0.0.1/api/bonding/account?address=not-an-address'),
    );
    assert.equal(junk.statusCode, 400);
  }

  const ok = mockResponse();
  await handleGet(
    mockRequest('198.51.100.77'),
    ok,
    new URL(`http://127.0.0.1/api/bonding/account?address=${SAMPLE_ADDRESS}`),
  );
  assert.equal(ok.statusCode, 200);
  assert.equal(rateLimiters.isBondingAccountRateLimited(mockRequest('198.51.100.78')), false);
});

test('GET /api/bonding/account checksums address and uses private no-store', async () => {
  let seenAddress: Address | null = null;
  const { handleGet } = createHandlers({
    loadAccount: async (address) => {
      seenAddress = address;
      return sampleAccount(address);
    },
  });

  const res = mockResponse();
  await handleGet(
    mockRequest(),
    res,
    new URL(`http://127.0.0.1/api/bonding/account?address=${SAMPLE_ADDRESS_LOWER}`),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(seenAddress, SAMPLE_ADDRESS);
  assert.deepEqual(parsedBody(res), sampleAccount(SAMPLE_ADDRESS));
});

test('GET /api/bonding/account returns 429 when rate limited', async () => {
  const { handleGet } = createHandlers();
  const req = mockRequest('198.51.100.50');

  for (let index = 0; index < 10; index += 1) {
    const ok = mockResponse();
    await handleGet(
      req,
      ok,
      new URL(`http://127.0.0.1/api/bonding/account?address=${SAMPLE_ADDRESS}`),
    );
    assert.equal(ok.statusCode, 200);
  }

  const limited = mockResponse();
  await handleGet(
    req,
    limited,
    new URL(`http://127.0.0.1/api/bonding/account?address=${SAMPLE_ADDRESS}`),
  );
  assert.equal(limited.statusCode, 429);
});

test('GET /api/bonding/account hard-fails with 502 when loader throws', async () => {
  const { handleGet } = createHandlers({
    loadAccount: async () => {
      throw new Error('one contract read failed POLYGON_RPC_URL=https://x/v2/KEY');
    },
  });

  const res = mockResponse();
  await handleGet(
    mockRequest(),
    res,
    new URL(`http://127.0.0.1/api/bonding/account?address=${SAMPLE_ADDRESS}`),
  );

  assert.equal(res.statusCode, 502);
  assert.equal(JSON.stringify(parsedBody(res)).includes('KEY'), false);
});

test('account mapper merges Buy/Sell × V1/V2 without dropping duplicate ids', () => {
  const sharedId = '42';
  const merged = mergeActiveBondRecords([
    mapActiveBondRecords(
      [
        {
          id: BigInt(sharedId),
          owner: SAMPLE_ADDRESS,
          wbtcAmount: 1n,
          pranaAmount: 2n,
          maturityTime: 3n,
          creationTime: 1n,
          lastClaimTime: 1n,
          claimedPrana: 0n,
          claimed: false,
        },
      ],
      'buy',
      'v1',
    ),
    mapActiveBondRecords(
      [
        {
          id: BigInt(sharedId),
          owner: SAMPLE_ADDRESS,
          wbtcAmount: 3n,
          pranaAmount: 4n,
          maturityTime: 5n,
          creationTime: 2n,
          lastClaimTime: 2n,
          claimedPrana: 0n,
          claimed: false,
        },
      ],
      'buy',
      'v2',
    ),
    mapActiveBondRecords(
      [
        {
          id: BigInt(sharedId),
          owner: SAMPLE_ADDRESS,
          pranaAmount: 5n,
          wbtcAmount: 6n,
          maturityTime: 7n,
          creationTime: 3n,
          lastClaimTime: 3n,
          claimedWbtc: 0n,
          claimed: false,
        },
      ],
      'sell',
      'v1',
    ),
    mapActiveBondRecords(
      [
        {
          id: BigInt(sharedId),
          owner: SAMPLE_ADDRESS,
          pranaAmount: 8n,
          wbtcAmount: 9n,
          maturityTime: 10n,
          creationTime: 4n,
          lastClaimTime: 4n,
          claimedWbtc: 0n,
          claimed: false,
        },
      ],
      'sell',
      'v2',
    ),
  ]);

  assert.equal(merged.length, 4);
  assert.deepEqual(
    merged.map((bond) => `${bond.side}:${bond.version}:${bond.id}`),
    ['buy:v1:42', 'buy:v2:42', 'sell:v1:42', 'sell:v2:42'],
  );
});

// ---------------------------------------------------------------------------
// Quote POST routes
// ---------------------------------------------------------------------------

test('POST /api/bonding/quote rejects non-POST with 405', async () => {
  const { handlePost } = createHandlers();
  const res = mockResponse();
  await handlePost(
    mockRequest('203.0.113.10', 'GET'),
    res,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.get('Allow'), 'POST');
});

test('POST /api/bonding/quote rejects non-JSON / empty / oversized / bad union without loader', async () => {
  const quoteCalls = { count: 0 };
  const { handlePost } = createHandlers({ quoteCalls });

  const plain = mockResponse();
  await handlePost(
    mockBodyRequest([Buffer.from('{}')], {
      'content-type': 'text/plain',
      host: '127.0.0.1',
    }),
    plain,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(plain.statusCode, 415);

  const empty = mockResponse();
  await handlePost(
    mockBodyRequest([Buffer.from('   ')]),
    empty,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(empty.statusCode, 400);

  const badJson = mockResponse();
  await handlePost(
    mockBodyRequest([Buffer.from('{')]),
    badJson,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(badJson.statusCode, 400);

  const oversized = mockResponse();
  await handlePost(
    mockBodyRequest([Buffer.from('x'.repeat(2049))]),
    oversized,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(oversized.statusCode, 400);

  const badUnion = mockResponse();
  await handlePost(
    mockBodyRequest([
      Buffer.from(JSON.stringify({ mode: 'nope', amountRaw: '1', termId: 1 })),
    ]),
    badUnion,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(badUnion.statusCode, 400);
  assert.equal(quoteCalls.count, 0);
});

test('POST /api/bonding/quote origin policy matches swap (same-origin / no Origin / forbidden)', async () => {
  const { handlePost } = createHandlers();

  const sameOrigin = mockResponse();
  await handlePost(
    mockBodyRequest(
      [
        Buffer.from(
          JSON.stringify({
            mode: 'buy_exact_wbtc',
            amountRaw: '1000',
            termId: 1,
          }),
        ),
      ],
      {
        'content-type': 'application/json',
        host: '127.0.0.1',
        origin: 'http://127.0.0.1',
      },
    ),
    sameOrigin,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(sameOrigin.statusCode, 200);

  const noOrigin = mockResponse();
  await handlePost(
    mockBodyRequest([
      Buffer.from(
        JSON.stringify({
          mode: 'buy_exact_wbtc',
          amountRaw: '1000',
          termId: 1,
        }),
      ),
    ]),
    noOrigin,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(noOrigin.statusCode, 200);

  const forbidden = mockResponse();
  await handlePost(
    mockBodyRequest(
      [
        Buffer.from(
          JSON.stringify({
            mode: 'buy_exact_wbtc',
            amountRaw: '1000',
            termId: 1,
          }),
        ),
      ],
      {
        'content-type': 'application/json',
        host: 'prana.example',
        origin: 'https://evil.test',
      },
    ),
    forbidden,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(forbidden.statusCode, 403);
});

test('POST /api/bonding/quote rejects junk before consuming global rate-limit quota', async () => {
  const quoteCalls = { count: 0 };
  const { handlePost, rateLimiters } = createHandlers({ quoteCalls });

  // Fill would-be global budget (60) with malformed / forbidden requests.
  for (let index = 0; index < 60; index += 1) {
    const plain = mockResponse();
    await handlePost(
      mockBodyRequest(
        [Buffer.from('{}')],
        { 'content-type': 'text/plain', host: '127.0.0.1' },
        `203.0.113.${index}`,
      ),
      plain,
      new URL('http://127.0.0.1/api/bonding/quote'),
    );
    assert.equal(plain.statusCode, 415);

    const forbidden = mockResponse();
    await handlePost(
      mockBodyRequest(
        [
          Buffer.from(
            JSON.stringify({
              mode: 'buy_exact_wbtc',
              amountRaw: '1000',
              termId: 1,
            }),
          ),
        ],
        {
          'content-type': 'application/json',
          host: 'prana.example',
          origin: 'https://evil.test',
        },
        `198.51.100.${index}`,
      ),
      forbidden,
      new URL('http://127.0.0.1/api/bonding/quote'),
    );
    assert.equal(forbidden.statusCode, 403);

    const badShape = mockResponse();
    await handlePost(
      mockBodyRequest(
        [Buffer.from(JSON.stringify({ mode: 'nope', amountRaw: '1', termId: 1 }))],
        { 'content-type': 'application/json', host: '127.0.0.1' },
        `192.0.2.${index}`,
      ),
      badShape,
      new URL('http://127.0.0.1/api/bonding/quote'),
    );
    assert.equal(badShape.statusCode, 400);
  }

  assert.equal(quoteCalls.count, 0);

  // Valid request must still succeed — junk did not burn the 60/min global budget.
  const ok = mockResponse();
  await handlePost(
    mockBodyRequest(
      [
        Buffer.from(
          JSON.stringify({
            mode: 'buy_exact_wbtc',
            amountRaw: '1000',
            termId: 1,
          }),
        ),
      ],
      { 'content-type': 'application/json', host: '127.0.0.1' },
      '198.51.100.77',
    ),
    ok,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );
  assert.equal(ok.statusCode, 200);
  assert.equal(quoteCalls.count, 1);
  assert.equal(rateLimiters.isBondingQuoteRateLimited(mockRequest('198.51.100.78')), false);
});

test('POST /api/bonding/quote returns 200 with issues and private no-store', async () => {
  const { handlePost } = createHandlers({
    loadQuote: async () => ({
      ...sampleQuote(),
      issues: ['below_minimum', 'paused'],
      pranaAmountRaw: '100',
    }),
  });

  const res = mockResponse();
  await handlePost(
    mockBodyRequest([
      Buffer.from(
        JSON.stringify({
          mode: 'buy_exact_wbtc',
          amountRaw: '1',
          termId: 1,
        }),
      ),
    ]),
    res,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  const body = parsedBody(res);
  assert.deepEqual(body.issues, ['below_minimum', 'paused']);
});

test('POST /api/bonding/quote returns 502 with redacted RPC errors', async () => {
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  };

  try {
    const { handlePost } = createHandlers({
      loadQuote: async () => {
        throw new Error('RPC https://polygon-mainnet.g.alchemy.com/v2/SECRET_ABC timed out');
      },
    });

    const res = mockResponse();
    await handlePost(
      mockBodyRequest([
        Buffer.from(
          JSON.stringify({
            mode: 'sell_exact_prana',
            amountRaw: '1000',
            termId: 0,
          }),
        ),
      ]),
      res,
      new URL('http://127.0.0.1/api/bonding/quote'),
    );

    assert.equal(res.statusCode, 502);
    assert.equal(JSON.stringify(parsedBody(res)).includes('SECRET'), false);
    assert.equal(logged.join('\n').includes('SECRET_ABC'), false);
  } finally {
    console.error = originalError;
  }
});

test('parseBondingQuoteRequest accepts the two modes and rejects bad shapes', () => {
  assert.deepEqual(
    parseBondingQuoteRequest({
      mode: 'buy_exact_wbtc',
      amountRaw: '999',
      termId: 4,
    }),
    { mode: 'buy_exact_wbtc', amountRaw: '999', termId: 4 },
  );
  assert.deepEqual(
    parseBondingQuoteRequest({
      mode: 'sell_exact_prana',
      amountRaw: '999',
      termId: 4,
    }),
    { mode: 'sell_exact_prana', amountRaw: '999', termId: 4 },
  );
  assert.throws(() =>
    parseBondingQuoteRequest({
      mode: 'buy_target_prana',
      amountRaw: '999',
      termId: 4,
    }),
  );

  assert.throws(() => parseBondingQuoteRequest({ mode: 'buy_exact_wbtc', amountRaw: '1', termId: 9 }));
  assert.throws(() =>
    parseBondingQuoteRequest({ mode: 'buy_exact_wbtc', amountRaw: '0x1', termId: 1 }),
  );
});

test('parseUnsignedDecimalRaw enforces canonical uint256 bounds', () => {
  assert.equal(parseUnsignedDecimalRaw('0'), 0n);
  assert.equal(parseUnsignedDecimalRaw('1'), 1n);
  assert.equal(parseUnsignedDecimalRaw(MAX_UINT256.toString()), MAX_UINT256);

  // Above uint256, leading zeros, hex, floats, and overlong digit strings.
  assert.equal(parseUnsignedDecimalRaw((MAX_UINT256 + 1n).toString()), null);
  assert.equal(parseUnsignedDecimalRaw('01'), null);
  assert.equal(parseUnsignedDecimalRaw('0x1'), null);
  assert.equal(parseUnsignedDecimalRaw('1.0'), null);
  assert.equal(parseUnsignedDecimalRaw('-1'), null);
  assert.equal(parseUnsignedDecimalRaw('9'.repeat(MAX_UINT256_DECIMAL_DIGITS + 1)), null);
  // Digit string near typical POST body cap (~2KB) must not parse as uint256.
  assert.equal(parseUnsignedDecimalRaw('9'.repeat(2000)), null);
});

test('bonding quote/create/claim reject zero and out-of-range decimals with validation errors', () => {
  assert.throws(
    () =>
      parseBondingQuoteRequest({
        mode: 'buy_exact_wbtc',
        amountRaw: '0',
        termId: 1,
      }),
    (err: unknown) =>
      err instanceof BondingApiValidationError &&
      err.message === 'Invalid bonding quote amount.',
  );
  assert.throws(
    () =>
      parseBondingQuoteRequest({
        mode: 'buy_exact_wbtc',
        amountRaw: (MAX_UINT256 + 1n).toString(),
        termId: 1,
      }),
    (err: unknown) => err instanceof BondingApiValidationError,
  );
  assert.deepEqual(
    parseBondingQuoteRequest({
      mode: 'buy_exact_wbtc',
      amountRaw: MAX_UINT256.toString(),
      termId: 1,
    }),
    {
      mode: 'buy_exact_wbtc',
      amountRaw: MAX_UINT256.toString(),
      termId: 1,
    },
  );

  // Approve zero is supported (ERC-20 revoke).
  assert.deepEqual(
    parseBondingConfirmationRequest(
      {
        transactionHash: SAMPLE_TX_HASH,
        account: SAMPLE_ADDRESS,
        action: { kind: 'approve', side: 'buy', amountRaw: '0' },
      },
      parseChecksumAddress,
    ).action,
    { kind: 'approve', side: 'buy', amountRaw: '0' },
  );

  assert.throws(
    () =>
      parseBondingConfirmationRequest(
        {
          transactionHash: SAMPLE_TX_HASH,
          account: SAMPLE_ADDRESS,
          action: {
            kind: 'create',
            side: 'buy',
            version: 'v2',
            mode: 'buy_exact_wbtc',
            amountRaw: '0',
            termId: 1,
          },
        },
        parseChecksumAddress,
      ),
    (err: unknown) =>
      err instanceof BondingApiValidationError &&
      err.message === 'Invalid bonding create amount.',
  );

  assert.throws(
    () =>
      parseBondingConfirmationRequest(
        {
          transactionHash: SAMPLE_TX_HASH,
          account: SAMPLE_ADDRESS,
          action: { kind: 'claim', side: 'buy', version: 'v2', bondId: '0' },
        },
        parseChecksumAddress,
      ),
    (err: unknown) =>
      err instanceof BondingApiValidationError &&
      err.message === 'Invalid bonding claim id.',
  );

  assert.throws(
    () =>
      parseBondingConfirmationRequest(
        {
          transactionHash: SAMPLE_TX_HASH,
          account: SAMPLE_ADDRESS,
          action: {
            kind: 'create',
            side: 'buy',
            version: 'v2',
            mode: 'buy_exact_wbtc',
            amountRaw: (MAX_UINT256 + 1n).toString(),
            termId: 1,
          },
        },
        parseChecksumAddress,
      ),
    (err: unknown) => err instanceof BondingApiValidationError,
  );
});

test('POST /api/bonding/quote returns 400 for out-of-range amountRaw before loader RPC', async () => {
  const { handlePost, quoteCalls } = createHandlers({
    loadQuote: async () => {
      throw new Error('loader should not run for invalid amountRaw');
    },
  });

  const res = mockResponse();
  await handlePost(
    mockBodyRequest([
      Buffer.from(
        JSON.stringify({
          mode: 'buy_exact_wbtc',
          amountRaw: (MAX_UINT256 + 1n).toString(),
          termId: 1,
        }),
      ),
    ]),
    res,
    new URL('http://127.0.0.1/api/bonding/quote'),
  );

  assert.equal(res.statusCode, 400);
  assert.equal(parsedBody(res).error, 'invalid_request');
  assert.equal(quoteCalls.count, 0);
});

// ---------------------------------------------------------------------------
// Quote math fixtures
// ---------------------------------------------------------------------------

const BASE_MATH = {
  termId: 1 as const,
  rateBps: 1000n, // 10%
  durationSeconds: SECONDS_PER_DAY * 30,
  paused: false,
  minPranaRaw: 1_000_000_000n,
  impactedWbtc: 1_000_000n,
  impactedPrana: 100_000_000_000n,
  poolWbtc: 2_000_000n,
  poolPrana: 200_000_000_000n,
  availableTreasuryRaw: 50_000_000_000n,
};

test('quote math: buy_exact_wbtc uses 1% fee, bps premium, and impacted when better', () => {
  const wbtcIn = 100_000n;
  const result = computeBondingQuote({
    ...BASE_MATH,
    mode: 'buy_exact_wbtc',
    amountRaw: wbtcIn,
  });

  const afterFee = mulDiv(wbtcIn, 99n, 100n);
  const impactedOut = mulDiv(
    BASE_MATH.impactedPrana,
    afterFee,
    BASE_MATH.impactedWbtc + afterFee,
  );
  const expected = mulDiv(impactedOut, 10000n, 9000n);

  assert.equal(result.reserveSource, 'impacted');
  assert.equal(result.wbtcAmountRaw, wbtcIn);
  assert.equal(result.pranaAmountRaw, expected);
  assert.deepEqual(result.issues, []);
});

test('quote math: buy_exact_wbtc syncs to market when impacted is worse for user', () => {
  // Impacted PRANA much higher → user would get more from impacted; contract syncs down to market.
  const result = computeBondingQuote({
    ...BASE_MATH,
    mode: 'buy_exact_wbtc',
    amountRaw: 100_000n,
    impactedPrana: 500_000_000_000n,
    poolPrana: 100_000_000_000n,
  });

  assert.equal(result.reserveSource, 'market');
  assert.equal(result.issues.includes('exceeds_reserve'), false);
});

test('quote math: sell_exact_prana applies fee then premium and min(impacted, market)', () => {
  const pranaIn = 5_000_000_000n;
  const result = computeBondingQuote({
    ...BASE_MATH,
    mode: 'sell_exact_prana',
    amountRaw: pranaIn,
    minPranaRaw: 1_000_000_000n,
    availableTreasuryRaw: 10_000_000n,
  });

  const net = mulDiv(pranaIn, 99n, 100n);
  const impactedOut = mulDiv(
    BASE_MATH.impactedWbtc,
    net,
    BASE_MATH.impactedPrana + net,
  );
  const expected = mulDiv(impactedOut, 11000n, 10000n);

  assert.equal(result.reserveSource, 'impacted');
  assert.equal(result.wbtcAmountRaw, expected);
  assert.deepEqual(result.issues, []);
});

test('quote math boundary: zero, below min, treasury shortfall, paused', () => {
  assert.deepEqual(
    computeBondingQuote({
      ...BASE_MATH,
      mode: 'buy_exact_wbtc',
      amountRaw: 0n,
    }).issues,
    ['zero_amount'],
  );

  const below = computeBondingQuote({
    ...BASE_MATH,
    mode: 'buy_exact_wbtc',
    amountRaw: 100_000n,
    minPranaRaw: 50_000_000_000n,
  });
  assert.equal(below.issues.includes('below_minimum'), true);

  // buy_exact_wbtc pushes exceeds_reserve when baseline >= impacted reserve.
  // With floor math that is effectively unreachable for positive reserves; sell
  // and buy paths still surface treasury / pause / zero / below_minimum.

  const treasury = computeBondingQuote({
    ...BASE_MATH,
    mode: 'buy_exact_wbtc',
    amountRaw: 100_000n,
    availableTreasuryRaw: 1n,
  });
  assert.equal(treasury.issues.includes('insufficient_treasury'), true);

  const paused = computeBondingQuote({
    ...BASE_MATH,
    mode: 'sell_exact_prana',
    amountRaw: 5_000_000_000n,
    paused: true,
  });
  assert.equal(paused.issues.includes('paused'), true);
});

test('quote math: treasury exactly enough vs one unit short', () => {
  const wbtcIn = 100_000n;
  const afterFee = mulDiv(wbtcIn, 99n, 100n);
  const impactedOut = mulDiv(
    BASE_MATH.impactedPrana,
    afterFee,
    BASE_MATH.impactedWbtc + afterFee,
  );
  const pranaOut = mulDiv(impactedOut, 10000n, 9000n);

  const enough = computeBondingQuote({
    ...BASE_MATH,
    mode: 'buy_exact_wbtc',
    amountRaw: wbtcIn,
    availableTreasuryRaw: pranaOut,
  });
  assert.equal(enough.issues.includes('insufficient_treasury'), false);
  assert.equal(enough.pranaAmountRaw, pranaOut);

  const short = computeBondingQuote({
    ...BASE_MATH,
    mode: 'buy_exact_wbtc',
    amountRaw: wbtcIn,
    availableTreasuryRaw: pranaOut - 1n,
  });
  assert.equal(short.issues.includes('insufficient_treasury'), true);
  assert.equal(short.pranaAmountRaw, 0n);
});

// ---------------------------------------------------------------------------
// Confirmation API
// ---------------------------------------------------------------------------

test('POST /api/bonding/confirm-transaction rejects bad body/hash/action before RPC', async () => {
  let confirmCalls = 0;
  const { handlePost } = createHandlers({
    confirmTransaction: async () => {
      confirmCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
  });

  const badHash = mockResponse();
  await handlePost(
    mockBodyRequest([
      Buffer.from(
        JSON.stringify({
          transactionHash: '0x1234',
          account: SAMPLE_ADDRESS,
          action: { kind: 'claim', side: 'buy', version: 'v2', bondId: '1' },
        }),
      ),
    ]),
    badHash,
    new URL('http://127.0.0.1/api/bonding/confirm-transaction'),
  );
  assert.equal(badHash.statusCode, 400);
  assert.equal(confirmCalls, 0);
});

test('POST /api/bonding/confirm-transaction rejects junk before consuming global rate-limit quota', async () => {
  let confirmCalls = 0;
  const { handlePost, rateLimiters } = createHandlers({
    confirmTransaction: async () => {
      confirmCalls += 1;
      return { status: 'confirmed', source: 'server' };
    },
  });

  const validBody = JSON.stringify({
    transactionHash: SAMPLE_TX_HASH,
    account: SAMPLE_ADDRESS,
    action: { kind: 'claim', side: 'buy', version: 'v2', bondId: '1' },
  });

  // Fill would-be global confirmation budget (120) with junk.
  for (let index = 0; index < 120; index += 1) {
    const plain = mockResponse();
    await handlePost(
      mockBodyRequest(
        [Buffer.from(validBody)],
        { 'content-type': 'text/plain', host: '127.0.0.1' },
        `203.0.113.${index % 200}`,
      ),
      plain,
      new URL('http://127.0.0.1/api/bonding/confirm-transaction'),
    );
    assert.equal(plain.statusCode, 415);

    const badHash = mockResponse();
    await handlePost(
      mockBodyRequest(
        [
          Buffer.from(
            JSON.stringify({
              transactionHash: '0x1234',
              account: SAMPLE_ADDRESS,
              action: { kind: 'claim', side: 'buy', version: 'v2', bondId: '1' },
            }),
          ),
        ],
        { 'content-type': 'application/json', host: '127.0.0.1' },
        `198.51.100.${index % 200}`,
      ),
      badHash,
      new URL('http://127.0.0.1/api/bonding/confirm-transaction'),
    );
    assert.equal(badHash.statusCode, 400);
  }

  assert.equal(confirmCalls, 0);

  const ok = mockResponse();
  await handlePost(
    mockBodyRequest(
      [Buffer.from(validBody)],
      { 'content-type': 'application/json', host: '127.0.0.1' },
      '198.51.100.77',
    ),
    ok,
    new URL('http://127.0.0.1/api/bonding/confirm-transaction'),
  );
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(confirmCalls, 1);
  assert.equal(rateLimiters.isBondingConfirmRateLimited(mockRequest('198.51.100.78')), false);
});

test('confirmBondingTransaction distinguishes success / revert / not_mined / RPC error', async () => {
  const action = {
    kind: 'claim' as const,
    side: 'buy' as const,
    version: 'v2' as const,
    bondId: '7',
  };
  const expected = buildExpectedCall(action);

  const confirmed = await confirmBondingTransaction(
    {
      transactionHash: SAMPLE_TX_HASH,
      account: SAMPLE_ADDRESS,
      action,
    },
    {
      getProvider: async () => ({
        async getTransaction() {
          return {
            from: SAMPLE_ADDRESS,
            to: expected.target,
            data: expected.data,
          };
        },
        async getTransactionReceipt() {
          return { status: 1 };
        },
      }),
    },
  );
  assert.deepEqual(confirmed, { status: 'confirmed', source: 'server' });

  const reverted = await confirmBondingTransaction(
    {
      transactionHash: SAMPLE_TX_HASH,
      account: SAMPLE_ADDRESS,
      action,
    },
    {
      getProvider: async () => ({
        async getTransaction() {
          return {
            from: SAMPLE_ADDRESS,
            to: expected.target,
            data: expected.data,
          };
        },
        async getTransactionReceipt() {
          return { status: 0 };
        },
      }),
    },
  );
  assert.deepEqual(reverted, { status: 'reverted', source: 'server' });

  const notMined = await confirmBondingTransaction(
    {
      transactionHash: SAMPLE_TX_HASH,
      account: SAMPLE_ADDRESS,
      action,
    },
    {
      getProvider: async () => ({
        async getTransaction() {
          return null;
        },
        async getTransactionReceipt() {
          return null;
        },
      }),
    },
  );
  assert.deepEqual(notMined, { status: 'not_mined' });

  const unavailable = await confirmBondingTransaction(
    {
      transactionHash: SAMPLE_TX_HASH,
      account: SAMPLE_ADDRESS,
      action,
    },
    {
      getProvider: async () => ({
        async getTransaction() {
          throw new Error('RPC down https://alchemy.com/v2/SECRET');
        },
        async getTransactionReceipt() {
          throw new Error('RPC down');
        },
      }),
    },
  );
  assert.deepEqual(unavailable, { status: 'confirmation_unavailable' });
});

test('confirmBondingTransaction rejects sender/target/calldata mismatch', async () => {
  const action = {
    kind: 'approve' as const,
    side: 'buy' as const,
    amountRaw: '1000',
  };
  const expected = buildExpectedCall(action);

  await assert.rejects(
    () =>
      confirmBondingTransaction(
        {
          transactionHash: SAMPLE_TX_HASH,
          account: SAMPLE_ADDRESS,
          action,
        },
        {
          getProvider: async () => ({
            async getTransaction() {
              return {
                from: '0x00000000000000000000000000000000000000aa',
                to: expected.target,
                data: expected.data,
              };
            },
            async getTransactionReceipt() {
              return { status: 1 };
            },
          }),
        },
      ),
    /sender/,
  );

  await assert.rejects(
    () =>
      confirmBondingTransaction(
        {
          transactionHash: SAMPLE_TX_HASH,
          account: SAMPLE_ADDRESS,
          action,
        },
        {
          getProvider: async () => ({
            async getTransaction() {
              return {
                from: SAMPLE_ADDRESS,
                to: SELL_BOND_ADDRESS_V2,
                data: expected.data,
              };
            },
            async getTransactionReceipt() {
              return { status: 1 };
            },
          }),
        },
      ),
    /target/,
  );
});

test('buildExpectedCall maps create/claim/approve to fixed internal targets', () => {
  const approveBuy = buildExpectedCall({
    kind: 'approve',
    side: 'buy',
    amountRaw: '1',
  });
  assert.equal(approveBuy.target.toLowerCase(), WBTC_ADDRESS.toLowerCase());

  const createSell = buildExpectedCall({
    kind: 'create',
    side: 'sell',
    version: 'v2',
    mode: 'sell_exact_prana',
    amountRaw: '1',
    termId: 2,
  });
  assert.equal(createSell.target.toLowerCase(), SELL_BOND_ADDRESS_V2.toLowerCase());

  const claimV1 = buildExpectedCall({
    kind: 'claim',
    side: 'sell',
    version: 'v1',
    bondId: '9',
  });
  assert.equal(claimV1.target.toLowerCase(), SELL_BOND_ADDRESS_V1.toLowerCase());
});

test('bonding upstream failures log redacted errors without RPC secrets', async () => {
  const { handleGet } = createHandlers({
    loadConfig: async () => {
      throw new Error('Alchemy https://polygon-mainnet.g.alchemy.com/v2/SECRET_KEY_ABC failed');
    },
  });

  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  };

  try {
    const res = mockResponse();
    await handleGet(mockRequest(), res, new URL('http://127.0.0.1/api/bonding/config'));
    assert.equal(res.statusCode, 502);
  } finally {
    console.error = originalError;
  }

  const combined = logged.join('\n');
  assert.match(combined, /Failed to load bonding config:/);
  assert.equal(combined.includes('SECRET_KEY'), false);
});

test('parseChecksumAddress still accepts valid addresses for bonding account', () => {
  assert.equal(parseChecksumAddress(SAMPLE_ADDRESS_LOWER), SAMPLE_ADDRESS);
});
