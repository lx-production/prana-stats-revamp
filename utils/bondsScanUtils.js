import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DEFAULT_RPC_FALLBACK = 'https://polygon-rpc.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isNumericKey(key) {
  // "0", "1", ... but not "01"
  return /^\d+$/.test(key);
}

function serializeForJson(value) {
  if (typeof value === 'bigint') return value.toString(); // JSON doesn't support BigInt
  if (Array.isArray(value)) return value.map(serializeForJson); // Recursively serialize arrays
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'length') continue;
      if (isNumericKey(k)) continue;
      out[k] = serializeForJson(v);
    }
    return out;
  }
  return value;
}

// Get the field names for the bonds tuple
function getBondTupleFieldNames(contract) {
  try {
    const fn = contract.interface.getFunction('bonds');
    const tuple = fn?.outputs?.[0];
    const components = tuple?.components;
    if (!Array.isArray(components) || components.length === 0) return null;

    return components.map((c, i) => (c?.name && c.name.trim() ? c.name.trim() : `field${i}`));
  } catch {
    return null;
  }
}

function parseDotEnv(content) {
  const env = {};
  const rawLine = content.split(/\r?\n/).find((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#');
  });
  if (!rawLine) return env; // Skip if no line was found

  const line = rawLine.trim();
  const cleaned = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
  const eq = cleaned.indexOf('=');
  if (eq === -1) return env;

  const key = cleaned.slice(0, eq).trim();
  const value = cleaned.slice(eq + 1).trim();
  if (key) env[key] = value;
  return env;
}

async function loadDotEnvIntoProcessEnv() {
  const candidates = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    '.env.production',
    '.env.production.local',
  ];

  for (const filename of candidates) {
    const fullPath = path.join(PROJECT_ROOT, filename);
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const parsed = parseDotEnv(content);
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    } catch {
      // ignore missing files
    }
  }
}

function getRpcUrl() {
  return (
    process.env.VITE_ALCHEMY_POLYGON_MAIN ||
    process.env.POLYGON_RPC_URL ||
    DEFAULT_RPC_FALLBACK
  );
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    // Alchemy URLs typically embed the key in pathname; mask the last segment.
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts[parts.length - 1] = '<redacted>';
      u.pathname = '/' + parts.join('/');
    }
    return u.toString();
  } catch {
    return '<invalid url>';
  }
}

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error.toLowerCase();
  if (typeof error === 'object') {
    const errObj = error;
    const nestedMessage = errObj?.error?.message;
    const infoMessage = errObj?.info?.error?.message;
    const message =
      errObj?.shortMessage ||
      errObj?.message ||
      errObj?.reason ||
      nestedMessage ||
      infoMessage ||
      '';
    if (typeof message === 'string') return message.toLowerCase();
  }
  return String(error).toLowerCase();
}

function getErrorMessageRaw(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const errObj = error;
    const nestedMessage = errObj?.error?.message;
    const infoMessage = errObj?.info?.error?.message;
    const message =
      errObj?.shortMessage ||
      errObj?.message ||
      errObj?.reason ||
      nestedMessage ||
      infoMessage ||
      '';
    if (typeof message === 'string') return message;
  }
  return String(error);
}

let didLogOutOfRange = false;

function getRevertDataHex(error) {
  if (!error || typeof error !== 'object') return null;
  const errObj = error;
  const candidates = [
    errObj?.data,
    errObj?.error?.data,
    errObj?.info?.error?.data,
    errObj?.info?.error?.data?.data,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('0x')) return c;
  }
  return null;
}

function getSolidityPanicCode(error) {
  // Solidity panics encode as: 0x4e487b71 (Panic(uint256)) + 32-byte code
  // Out-of-bounds array access is panic code 0x32.
  const data = getRevertDataHex(error);
  if (!data || !data.startsWith('0x4e487b71')) return null;
  if (data.length < 10 + 64) return null;
  try {
    const codeHex = '0x' + data.slice(10, 10 + 64);
    return BigInt(codeHex);
  } catch {
    return null;
  }
}

function isOutOfRangeError(error) {
  const errObj = error;
  const isCallException = errObj?.code === 'CALL_EXCEPTION';
  const revertData = getRevertDataHex(error);
  const noRevertData = revertData === '0x';
  const reason = errObj?.reason || errObj?.error?.reason || '';

  const panicCode = getSolidityPanicCode(error);
  const isArrayOutOfBounds = panicCode === 0x32n;

  // In these bond contracts, "out of range" appears as a require(false) with no revert data.
  const isRequireFalseNoData = isCallException && noRevertData && reason === 'require(false)';

  const isOutOfRange = isArrayOutOfBounds || isRequireFalseNoData;

  if (isOutOfRange && !didLogOutOfRange) {
    didLogOutOfRange = true;
    console.warn('OutOfRangeError sample (first seen):', {
      message: getErrorMessageRaw(error),
      code: errObj?.code,
      reason,
      revertData,
      panicCode: panicCode?.toString(16),
    });
  }

  return isOutOfRange;
}

function isRateLimitError(error) {
  const message = getErrorMessage(error);
  return (
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('retry in')
  );
}

function toBigInt(value) {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string' && value.length > 0) return BigInt(value);
    if (value && typeof value.toString === 'function') return BigInt(value.toString());
  } catch {
    // ignore parse failures and treat as 0
  }
  return 0n;
}

export {
  sleep,
  isNumericKey,
  serializeForJson,
  getBondTupleFieldNames,
  parseDotEnv,
  loadDotEnvIntoProcessEnv,
  getRpcUrl,
  redactUrl,
  getErrorMessage,
  getErrorMessageRaw,
  getRevertDataHex,
  getSolidityPanicCode,
  isOutOfRangeError,
  isRateLimitError,
  toBigInt,
  PROJECT_ROOT,
};