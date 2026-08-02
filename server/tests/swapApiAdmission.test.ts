import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createWeb3RateLimiters } from '../rateLimit.ts';
import { createPostApiRouteHandler } from '../postApiRoutes.ts';

import type { IncomingMessage, ServerResponse } from 'node:http';

type MockHeaderValue = number | string | string[];

type MockResponse = ServerResponse & {
  headers: Map<string, MockHeaderValue>;
  body: string;
};

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

function mockBodyRequest(
  chunks: Buffer[],
  headers: Record<string, string> = {
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

function mockRequest(remoteAddress: string): IncomingMessage {
  return {
    headers: {},
    socket: { remoteAddress },
  } as IncomingMessage;
}

function parsedBody(res: MockResponse): Record<string, unknown> {
  return JSON.parse(res.body) as Record<string, unknown>;
}

const VALID_QUOTE_BODY = JSON.stringify({
  tokenInSymbol: 'USDC',
  tokenOutSymbol: 'PRANA',
  amountIn: '1',
  recipient: '0x0000000000000000000000000000000000000001',
  slippageBps: 50,
});

test('POST /api/swap/quote rejects junk before consuming global quote rate-limit quota', async () => {
  const rateLimiters = createWeb3RateLimiters();
  const handlePost = createPostApiRouteHandler(rateLimiters);

  // Fill would-be global budget (30) with malformed / forbidden / bad-shape requests.
  for (let index = 0; index < 30; index += 1) {
    const plain = mockResponse();
    await handlePost(
      mockBodyRequest(
        [Buffer.from('{}')],
        { 'content-type': 'text/plain', host: '127.0.0.1' },
        `203.0.113.${index}`,
      ),
      plain,
      new URL('http://127.0.0.1/api/swap/quote'),
    );
    assert.equal(plain.statusCode, 415);

    const forbidden = mockResponse();
    await handlePost(
      mockBodyRequest(
        [Buffer.from(VALID_QUOTE_BODY)],
        {
          'content-type': 'application/json',
          host: 'prana.example',
          origin: 'https://evil.test',
        },
        `198.51.100.${index}`,
      ),
      forbidden,
      new URL('http://127.0.0.1/api/swap/quote'),
    );
    assert.equal(forbidden.statusCode, 403);

    const badShape = mockResponse();
    await handlePost(
      mockBodyRequest(
        [
          Buffer.from(
            JSON.stringify({
              tokenInSymbol: 'FAKE',
              tokenOutSymbol: 'PRANA',
              amountIn: '1',
              recipient: '0x0000000000000000000000000000000000000001',
              slippageBps: 50,
            }),
          ),
        ],
        { 'content-type': 'application/json', host: '127.0.0.1' },
        `192.0.2.${index}`,
      ),
      badShape,
      new URL('http://127.0.0.1/api/swap/quote'),
    );
    assert.equal(badShape.statusCode, 400);
    assert.equal(parsedBody(badShape).message, 'Unsupported swap token.');
  }

  // Junk must not have spent the 30/min global swap quote budget.
  assert.equal(rateLimiters.isSwapQuoteRateLimited(mockRequest('198.51.100.77')), false);
});
