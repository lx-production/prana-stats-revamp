import type { ServerResponse } from 'node:http';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FRONTEND_POLYGON_RPC_URL } from '../../constants/network.ts';
import { setSecurityHeaders } from '../securityHeaders.ts';

type MockHeaderValue = number | string | string[];
type MockResponse = ServerResponse & { headers: Map<string, MockHeaderValue> };

function isStringArray(value: number | string | readonly string[]): value is readonly string[] {
  return Array.isArray(value);
}

function mockResponse(): MockResponse {
  const headers = new Map<string, MockHeaderValue>();

  return {
    headers,
    setHeader(name: string, value: number | string | readonly string[]) {
      headers.set(name, isStringArray(value) ? [...value] : value);
      return this as ServerResponse;
    },
  } as MockResponse;
}

function getContentSecurityPolicy(res: MockResponse): string {
  const csp = res.headers.get('Content-Security-Policy');
  if (typeof csp !== 'string') {
    assert.fail('Content-Security-Policy header was not set');
  }
  return csp;
}

test('CSP connect-src allows blob texture URLs, Polygon RPC, and model-viewer CDN hosts', () => {
  const res = mockResponse();

  setSecurityHeaders(res);

  const csp = getContentSecurityPolicy(res);
  // Order: self → blob → pinned RPC → model-viewer script host → Draco host
  assert.match(
    csp,
    new RegExp(
      `(?:^|; )connect-src 'self' blob: ${FRONTEND_POLYGON_RPC_URL} https://ajax\\.googleapis\\.com https://www\\.gstatic\\.com(?:;|$)`,
    ),
  );
  assert.doesNotMatch(csp, /connect-src[^;]*https:\/\/polygon-rpc\.com/);
});

test('CSP allows model-viewer script/Draco hosts and blob workers', () => {
  const res = mockResponse();

  setSecurityHeaders(res);

  const csp = getContentSecurityPolicy(res);
  assert.match(
    csp,
    /(?:^|; )script-src 'self' https:\/\/ajax\.googleapis\.com https:\/\/www\.gstatic\.com 'wasm-unsafe-eval'(?:;|$)/,
  );
  assert.match(csp, /(?:^|; )worker-src 'self' blob:(?:;|$)/);
  // model-src is not a real CSP directive — keep it out of the policy
  assert.doesNotMatch(csp, /model-src/);
});

test('CSP img-src only allows same-origin and data images', () => {
  const res = mockResponse();

  setSecurityHeaders(res);

  const csp = getContentSecurityPolicy(res);
  assert.match(csp, /(?:^|; )img-src 'self' data:(?:;|$)/);
  assert.doesNotMatch(csp, /img-src[^;]*https:/);
});
