import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { createStaticRequestHandler } from '../staticRoutes.ts';
import {
  BOND_PATH,
  isBondPath,
  BOND_CANONICAL_PATH,
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
  fixtureDistDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prana-bond-routes-'));
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

test('isBondPath matches /bond and /bond/* but not /bonding or /bonds', () => {
  assert.equal(isBondPath(BOND_PATH), true);
  assert.equal(isBondPath(BOND_CANONICAL_PATH), true);
  assert.equal(isBondPath('/bond/preview'), true);
  assert.equal(isBondPath('/bonding'), false);
  assert.equal(isBondPath('/bonds'), false);
  assert.equal(isBondPath('/'), false);
});

test('GET /bond redirects 308 to canonical path', async () => {
  const res = mockResponse();
  const handled = await handleStaticRequest(
    mockRequest(),
    res,
    new URL('http://127.0.0.1/bond'),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 308);
  assert.equal(res.headers.get('Location'), BOND_CANONICAL_PATH);
});

test('GET /bond preserves query string on 308 redirect', async () => {
  const res = mockResponse();
  const handled = await handleStaticRequest(
    mockRequest(),
    res,
    new URL('http://127.0.0.1/bond?ref=hero'),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 308);
  assert.equal(res.headers.get('Location'), `${BOND_CANONICAL_PATH}?ref=hero`);
});

test('GET /bond/ serves SPA shell HTML', async () => {
  const res = mockResponse();
  const handled = await handleStaticRequest(
    mockRequest(),
    res,
    new URL(`http://127.0.0.1${BOND_CANONICAL_PATH}`),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers.get('Content-Type') ?? ''), /text\/html/);
  assert.match(bodyText(res), /<div id="root"><\/div>/);
});

test('GET /bond/preview serves SPA shell HTML (client subpath fallback)', async () => {
  const res = mockResponse();
  const handled = await handleStaticRequest(
    mockRequest(),
    res,
    new URL('http://127.0.0.1/bond/preview'),
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers.get('Content-Type') ?? ''), /text\/html/);
  assert.match(bodyText(res), /<div id="root"><\/div>/);
});

test('GET /bonding is not treated as the bonding route redirect', async () => {
  const res = mockResponse();
  const handled = await handleStaticRequest(
    mockRequest(),
    res,
    new URL('http://127.0.0.1/bonding'),
  );

  // Falls through to general SPA fallback (fixture index.html), not 308 → /bond/
  assert.equal(handled, true);
  assert.notEqual(res.statusCode, 308);
  assert.equal(res.headers.get('Location'), undefined);
  assert.equal(isBondPath('/bonding'), false);
  assert.match(bodyText(res), /<div id="root"><\/div>/);
});

test('Hero BOND CTA uses canonical same-tab path (not production absolute URL)', async () => {
  const heroSource = await fs.readFile(
    path.join(process.cwd(), 'hero3.tsx'),
    'utf8',
  );

  assert.match(heroSource, /BOND_CANONICAL_PATH/);
  assert.match(heroSource, /href=\{BOND_CANONICAL_PATH\}/);
  assert.doesNotMatch(heroSource, /https:\/\/prana\.triethocduongpho\.net\/bond\//);

  // The BOND CTA block must not open a new tab (STAKE already same-tab).
  const bondAnchorMatch = heroSource.match(
    /href=\{BOND_CANONICAL_PATH\}[\s\S]*?>\s*BOND \(OTC\)/,
  );
  assert.ok(bondAnchorMatch, 'expected BOND (OTC) anchor using BOND_CANONICAL_PATH');
  assert.doesNotMatch(bondAnchorMatch[0], /target="_blank"/);
});
