// HTTP security headers applied to every server response (API + static files).
// Called from requestHelpers.ts (sendJson/sendText) and serveFile.ts.
import type { ServerResponse } from 'node:http';
import { FRONTEND_POLYGON_RPC_URL } from '../constants/network.ts';

// Content-Security-Policy tells the browser what resources the page is allowed to load.
// Each directive limits a specific resource type; 'self' means same-origin only.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'", // fallback for any directive not listed below
  "base-uri 'self'", // <base> tags can only point to our own domain
  "object-src 'none'", // block Flash/plugins entirely
  "frame-ancestors 'none'", // prevent our page from being embedded in iframes (clickjacking)
  "script-src 'self' https://ajax.googleapis.com", // our JS bundles + Google AJAX CDN
  "style-src 'self' 'unsafe-inline'", // our CSS + inline <style> tags (needed by some libs)
  "img-src 'self' data:", // images from our domain or base64 data: URLs only
  "font-src 'self' data:", // fonts from our domain or base64 data: URLs only
  // fetch/XHR/WebSocket targets: our API + the Polygon RPC (must match wagmiConfig)
  `connect-src 'self' ${FRONTEND_POLYGON_RPC_URL}`,
  "model-src 'self'", // 3D models (.glb) served from our domain
  "form-action 'self'", // forms can only submit to our own domain
].join('; ');

export function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Frame-Options', 'DENY'); // legacy iframe protection (backup for frame-ancestors)
  res.setHeader('X-Content-Type-Options', 'nosniff'); // don't guess MIME types (prevents script injection via uploads)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // send full URL on same-origin, origin-only on cross-origin
}
