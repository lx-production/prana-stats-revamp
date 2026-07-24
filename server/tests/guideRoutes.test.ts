import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createStaticRequestHandler } from '../staticRoutes.ts';
import {
  GUIDE_SWAP_PATH,
  GUIDE_STAKING_PATH,
  isGuideSwapPath,
  isGuideStakingPath,
  GUIDE_SWAP_CANONICAL_PATH,
  GUIDE_STAKING_CANONICAL_PATH,
} from '../../constants/appRoutes.ts';

import type { IncomingMessage, ServerResponse } from 'node:http';

type MockHeaderValue = number | string | string[];

type MockResponse = ServerResponse & {
  headers: Map<string, MockHeaderValue>;
  body: string | Buffer;
};

/** Minimal SPA shell — enough for route tests without a Vite build artifact. */
const SPA_SHELL_HTML = '<!doctype html><html><body><div id="root"></div></body></html>';

let fixtureDistDir = '';
let handleStaticRequest = createStaticRequestHandler();

before(async () => {
  fixtureDistDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prana-guide-routes-'));
  await fs.writeFile(path.join(fixtureDistDir, 'index.html'), SPA_SHELL_HTML, 'utf8');
  handleStaticRequest = createStaticRequestHandler({ distDir: fixtureDistDir });
});

after(async () => {
  if (fixtureDistDir) {
    await fs.rm(fixtureDistDir, { recursive: true, force: true });
  }
});

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
      if (Buffer.isBuffer(chunk)) {
        this.body = chunk;
      } else {
        this.body = typeof chunk === 'string' ? chunk : String(chunk ?? '');
      }
      return this as ServerResponse;
    },
  } as MockResponse;
}

function mockRequest(headers: Record<string, string | undefined> = {}): IncomingMessage {
  return { headers } as IncomingMessage;
}

function bodyText(res: MockResponse): string {
  return Buffer.isBuffer(res.body) ? res.body.toString('utf8') : String(res.body);
}

test('isGuideSwapPath matches /guide/swap and /guide/swap/*', () => {
  assert.equal(isGuideSwapPath(GUIDE_SWAP_PATH), true);
  assert.equal(isGuideSwapPath(GUIDE_SWAP_CANONICAL_PATH), true);
  assert.equal(isGuideSwapPath('/guide/swap/section'), true);
  assert.equal(isGuideSwapPath('/guide/staking/'), false);
  assert.equal(isGuideSwapPath('/guide'), false);
});

test('isGuideStakingPath matches /guide/staking and /guide/staking/*', () => {
  assert.equal(isGuideStakingPath(GUIDE_STAKING_PATH), true);
  assert.equal(isGuideStakingPath(GUIDE_STAKING_CANONICAL_PATH), true);
  assert.equal(isGuideStakingPath('/guide/staking/section'), true);
  assert.equal(isGuideStakingPath('/guide/swap/'), false);
  assert.equal(isGuideStakingPath('/stake/'), false);
});

test('GET /guide/swap redirects 308 to canonical path', async () => {
  const res = mockResponse();
  const handled = await handleStaticRequest(
    mockRequest(),
    res,
    new URL('http://127.0.0.1/guide/swap'),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 308);
  assert.equal(res.headers.get('Location'), GUIDE_SWAP_CANONICAL_PATH);
});

test('GET /guide/staking redirects 308 and preserves query string', async () => {
  const res = mockResponse();
  const handled = await handleStaticRequest(
    mockRequest(),
    res,
    new URL('http://127.0.0.1/guide/staking?from=footer'),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 308);
  assert.equal(
    res.headers.get('Location'),
    `${GUIDE_STAKING_CANONICAL_PATH}?from=footer`,
  );
});

test('GET /guide/swap/ serves SPA shell HTML', async () => {
  const res = mockResponse();
  const handled = await handleStaticRequest(
    mockRequest(),
    res,
    new URL(`http://127.0.0.1${GUIDE_SWAP_CANONICAL_PATH}`),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers.get('Content-Type') ?? ''), /text\/html/);
  assert.match(bodyText(res), /<div id="root"><\/div>/);
});

test('GET /guide/staking/ serves SPA shell HTML', async () => {
  const res = mockResponse();
  const handled = await handleStaticRequest(
    mockRequest(),
    res,
    new URL(`http://127.0.0.1${GUIDE_STAKING_CANONICAL_PATH}`),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers.get('Content-Type') ?? ''), /text\/html/);
  assert.match(bodyText(res), /<div id="root"><\/div>/);
});
