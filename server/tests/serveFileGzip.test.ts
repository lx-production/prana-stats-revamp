/// <reference types="node" />
/**
 * Characterization: Node prefers Vite `*.gz` siblings when Accept-Encoding allows gzip.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { serveFile } from '../serveFile.ts';

import type { IncomingMessage, ServerResponse } from 'node:http';

type CapturedResponse = {
  statusCode: number;
  headers: Record<string, string | number | string[]>;
  body: Buffer;
};

function createMockRes(): ServerResponse & { capture: CapturedResponse } {
  const capture: CapturedResponse = { statusCode: 200, headers: {}, body: Buffer.alloc(0) };
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number | readonly string[]) {
      capture.headers[name.toLowerCase()] = value as string | number | string[];
    },
    end(chunk?: unknown) {
      capture.statusCode = res.statusCode;
      if (chunk !== undefined && chunk !== null) {
        capture.body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      }
    },
    capture,
  };
  return res as unknown as ServerResponse & { capture: CapturedResponse };
}

function createMockReq(acceptEncoding?: string): IncomingMessage {
  return {
    headers: acceptEncoding === undefined ? {} : { 'accept-encoding': acceptEncoding },
  } as IncomingMessage;
}

test('serveFile sends precompressed .gz body with Content-Encoding when accepted', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prana-gzip-'));
  const logical = path.join(dir, 'app.js');
  const raw = Buffer.from('console.log("hello gzip characterization");');
  const compressed = gzipSync(raw, { level: 9 });
  await fs.writeFile(logical, raw);
  await fs.writeFile(`${logical}.gz`, compressed);

  const res = createMockRes();
  await serveFile(createMockReq('gzip'), res, logical);

  assert.equal(res.capture.statusCode, 200);
  assert.equal(res.capture.headers['content-encoding'], 'gzip');
  assert.equal(res.capture.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(res.capture.headers.vary, 'Accept-Encoding');
  assert.deepEqual(res.capture.body, compressed);

  await fs.rm(dir, { recursive: true, force: true });
});

test('serveFile falls back to raw bytes when client does not accept gzip', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prana-gzip-'));
  const logical = path.join(dir, 'app.js');
  const raw = Buffer.from('console.log("raw fallback");');
  await fs.writeFile(logical, raw);
  await fs.writeFile(`${logical}.gz`, gzipSync(raw, { level: 9 }));

  const res = createMockRes();
  await serveFile(createMockReq('identity'), res, logical);

  assert.equal(res.capture.statusCode, 200);
  assert.equal(res.capture.headers['content-encoding'], undefined);
  assert.deepEqual(res.capture.body, raw);

  await fs.rm(dir, { recursive: true, force: true });
});
