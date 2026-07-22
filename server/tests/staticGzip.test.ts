/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clientAcceptsGzip,
  gzipSiblingPath,
  isGzipEligiblePath,
} from '../helpers/staticGzip.ts';

import type { IncomingMessage } from 'node:http';

function fakeReq(acceptEncoding?: string): IncomingMessage {
  return {
    headers: acceptEncoding === undefined ? {} : { 'accept-encoding': acceptEncoding },
  } as IncomingMessage;
}

test('clientAcceptsGzip detects gzip token in Accept-Encoding', () => {
  assert.equal(clientAcceptsGzip(fakeReq()), false);
  assert.equal(clientAcceptsGzip(fakeReq('identity')), false);
  assert.equal(clientAcceptsGzip(fakeReq('gzip')), true);
  assert.equal(clientAcceptsGzip(fakeReq('br, gzip;q=0.8')), true);
  assert.equal(clientAcceptsGzip(fakeReq('x-gzip')), false);
});

test('isGzipEligiblePath only allows compressible text-like assets', () => {
  assert.equal(isGzipEligiblePath('/a/index.js'), true);
  assert.equal(isGzipEligiblePath('/a/index.css'), true);
  assert.equal(isGzipEligiblePath('/a/index.html'), true);
  assert.equal(isGzipEligiblePath('/a/icon.png'), false);
  assert.equal(isGzipEligiblePath('/a/prana-coin.glb'), false);
  assert.equal(isGzipEligiblePath('/a/photo.webp'), false);
});

test('gzipSiblingPath appends .gz to the logical file path', () => {
  assert.equal(gzipSiblingPath('/dist/assets/index-abc.js'), '/dist/assets/index-abc.js.gz');
});
