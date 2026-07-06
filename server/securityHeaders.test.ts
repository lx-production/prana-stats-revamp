import type { ServerResponse } from 'node:http';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FRONTEND_POLYGON_RPC_URL } from '../constants/network.ts';
import { setSecurityHeaders } from './securityHeaders.ts';

function mockResponse(): ServerResponse & { headers: Map<string, number | string | string[]> } {
  const headers = new Map<string, number | string | string[]>();

  return {
    headers,
    setHeader(name: string, value: number | string | readonly string[]) {
      headers.set(name, Array.isArray(value) ? [...value] : value);
      return this as ServerResponse;
    },
  } as ServerResponse & { headers: Map<string, number | string | string[]> };
}

test('CSP connect-src matches the pinned frontend Polygon RPC host', () => {
  const res = mockResponse();

  setSecurityHeaders(res);

  const csp = res.headers.get('Content-Security-Policy');
  assert.equal(typeof csp, 'string');
  assert.match(csp, new RegExp(`(?:^|; )connect-src 'self' ${FRONTEND_POLYGON_RPC_URL}(?:;|$)`));
  assert.doesNotMatch(csp, /connect-src[^;]*https:\/\/polygon-rpc\.com/);
});

test('CSP img-src only allows same-origin and data images', () => {
  const res = mockResponse();

  setSecurityHeaders(res);

  const csp = res.headers.get('Content-Security-Policy');
  assert.equal(typeof csp, 'string');
  assert.match(csp, /(?:^|; )img-src 'self' data:(?:;|$)/);
  assert.doesNotMatch(csp, /img-src[^;]*https:/);
});
