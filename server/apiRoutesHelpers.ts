import { sendJson } from './requestHelpers.ts';

import type { RequestHandler } from './types/httpTypes.ts';

/** Returns a safe user-facing error message for swap API failures. Only known validation errors are passed through; everything else uses the fallback so internal details are not leaked. */
export function sanitizeSwapErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const allowedMessages = [
    'Choose two different tokens.',
    'Connect a valid wallet address.',
    'Enter an amount greater than zero.',
    'No Uniswap route found for this pair or amount.',
    'Request body is required.',
    'Request body is too large.',
    'Expected application/json request body.',
    'Cross-origin swap API requests are not allowed.',
  ];

  if (allowedMessages.includes(error.message)) return error.message;
  if (error instanceof SyntaxError) return 'Invalid JSON request body.';
  return fallback;
}

/** Returns true when the request Content-Type header indicates a JSON body (e.g. application/json or application/vnd.api+json). */
function isJsonRequest(req: Parameters<RequestHandler>[0]): boolean {
  const contentType = req.headers['content-type'];
  const raw = Array.isArray(contentType) ? contentType[0] : contentType;
  if (!raw) return false;
  return /^application\/(?:json|[\w!#$&^.-]+\+json)\b/i.test(raw);
}

/** Extracts the hostname from a Host header value, stripping the port and handling IPv6 bracket notation. */
function hostnameFromHostHeader(host: string): string {
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    return end >= 0 ? host.slice(1, end).toLowerCase() : host.toLowerCase();
  }

  return host.split(':')[0]?.toLowerCase() ?? host.toLowerCase();
}

/** Returns true for loopback hostnames (localhost, 127.0.0.1, ::1). */
function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/** Collects host values from the Host and X-Forwarded-Host headers, used to compare against the request Origin. */
function requestHostCandidates(req: Parameters<RequestHandler>[0]): string[] {
  const hosts = [req.headers.host];
  const forwardedHost = req.headers['x-forwarded-host'];

  if (typeof forwardedHost === 'string') {
    hosts.push(...forwardedHost.split(',').map((value) => value.trim()).filter(Boolean));
  } else if (Array.isArray(forwardedHost)) {
    hosts.push(...forwardedHost);
  }

  return hosts.filter((host): host is string => Boolean(host));
}

/** Returns true when the Origin header is absent (non-browser) or matches the request host. Blocks cross-origin browser calls to swap endpoints. */
function isAllowedBrowserOrigin(req: Parameters<RequestHandler>[0]): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (Array.isArray(origin)) return false;

  const hosts = requestHostCandidates(req);
  if (!hosts.length) return false;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host.toLowerCase();
    if (hosts.some((host) => originHost === host.toLowerCase())) return true;

    return isLocalHostname(originUrl.hostname.toLowerCase()) &&
      hosts.some((host) => isLocalHostname(hostnameFromHostHeader(host)));
  } catch {
    return false;
  }
}

/** Validates swap API requests for JSON content type and same-origin policy. Sends an error response and returns true when the request should be rejected. */
export function rejectInvalidSwapApiRequest(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
): boolean {
  if (!isJsonRequest(req)) {
    sendJson(res, 415, {
      error: 'unsupported_media_type',
      message: 'Expected application/json request body.',
    });
    return true;
  }

  if (!isAllowedBrowserOrigin(req)) {
    sendJson(res, 403, {
      error: 'forbidden_origin',
      message: 'Cross-origin swap API requests are not allowed.',
    });
    return true;
  }

  return false;
}
