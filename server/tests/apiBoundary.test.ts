import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readJsonBody } from '../helpers/requestHelpers.ts';
import {
  rejectInvalidSwapApiRequest,
  sanitizeSwapErrorMessage,
} from '../helpers/apiRoutesHelpers.ts';

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

function mockApiRequest(headers: Record<string, string | string[] | undefined>): IncomingMessage {
  return { headers } as IncomingMessage;
}

// Readable request body as an async iterable of chunks (what readJsonBody consumes)
function mockBodyRequest(chunks: Array<string | Buffer>): IncomingMessage {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as IncomingMessage;
}

function parsedBody(res: MockResponse): { error?: string; message?: string } {
  return JSON.parse(res.body) as { error?: string; message?: string };
}

test('rejectInvalidSwapApiRequest rejects non-JSON content types with 415', () => {
  const res = mockResponse();

  const rejected = rejectInvalidSwapApiRequest(
    mockApiRequest({ 'content-type': 'text/plain', host: 'localhost:4174' }),
    res,
  );

  assert.equal(rejected, true);
  assert.equal(res.statusCode, 415);
  assert.deepEqual(parsedBody(res), {
    error: 'unsupported_media_type',
    message: 'Expected application/json request body.',
  });
});

test('rejectInvalidSwapApiRequest accepts application/json with charset', () => {
  const res = mockResponse();

  const rejected = rejectInvalidSwapApiRequest(
    mockApiRequest({
      host: 'localhost:4174',
      'content-type': 'application/json; charset=utf-8',
    }),
    res,
  );

  assert.equal(rejected, false);
  assert.equal(res.body, '');
});

test('rejectInvalidSwapApiRequest rejects cross-origin browser requests with 403', () => {
  const res = mockResponse();

  const rejected = rejectInvalidSwapApiRequest(
    mockApiRequest({
      host: 'example.test',
      origin: 'https://evil.test',
      'content-type': 'application/json',
    }),
    res,
  );

  assert.equal(rejected, true);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(parsedBody(res), {
    error: 'forbidden_origin',
    message: 'Cross-origin swap API requests are not allowed.',
  });
});

test('rejectInvalidSwapApiRequest allows same-origin browser requests', () => {
  const res = mockResponse();

  const rejected = rejectInvalidSwapApiRequest(
    mockApiRequest({
      host: 'example.test',
      origin: 'https://example.test',
      'content-type': 'application/json',
    }),
    res,
  );

  assert.equal(rejected, false);
});

test('rejectInvalidSwapApiRequest allows non-browser requests with no Origin header', () => {
  const res = mockResponse();

  const rejected = rejectInvalidSwapApiRequest(
    mockApiRequest({
      host: 'example.test',
      'content-type': 'application/json',
    }),
    res,
  );

  assert.equal(rejected, false);
});

test('rejectInvalidSwapApiRequest allows local Vite origin against local API host', () => {
  const res = mockResponse();

  const rejected = rejectInvalidSwapApiRequest(
    mockApiRequest({
      host: '127.0.0.1:4174',
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
    }),
    res,
  );

  assert.equal(rejected, false);
});

test('sanitizeSwapErrorMessage passes through allowlisted messages', () => {
  assert.equal(
    sanitizeSwapErrorMessage(new Error('Request body is too large.'), 'fallback'),
    'Request body is too large.',
  );
});

test('sanitizeSwapErrorMessage maps SyntaxError to Invalid JSON request body', () => {
  assert.equal(
    sanitizeSwapErrorMessage(new SyntaxError('Unexpected token'), 'fallback'),
    'Invalid JSON request body.',
  );
});

test('sanitizeSwapErrorMessage hides unknown internal errors behind the fallback', () => {
  assert.equal(
    sanitizeSwapErrorMessage(new Error('Alchemy API key abc123 failed'), 'Failed to load swap quote.'),
    'Failed to load swap quote.',
  );
  assert.equal(
    sanitizeSwapErrorMessage('not-an-error', 'Failed to write swap log.'),
    'Failed to write swap log.',
  );
});

test('readJsonBody parses a valid JSON body', async () => {
  const body = await readJsonBody<{ amountIn: string }>(
    mockBodyRequest([Buffer.from('{"amountIn":"1"}')]),
    2048,
  );

  assert.deepEqual(body, { amountIn: '1' });
});

test('readJsonBody rejects an empty body', async () => {
  await assert.rejects(
    readJsonBody(mockBodyRequest([Buffer.from('   ')]), 2048),
    /Request body is required/,
  );
});

test('readJsonBody enforces the max byte size while streaming', async () => {
  // Quote endpoint cap is 2048 bytes — stream past it before JSON.parse would run
  const oversized = 'x'.repeat(2049);

  await assert.rejects(
    readJsonBody(mockBodyRequest([Buffer.from(oversized)]), 2048),
    /Request body is too large/,
  );
});

test('readJsonBody rejects oversized bodies even when split across chunks', async () => {
  await assert.rejects(
    readJsonBody(
      mockBodyRequest([Buffer.from('a'.repeat(1500)), Buffer.from('b'.repeat(600))]),
      2048,
    ),
    /Request body is too large/,
  );
});
