// HTTP security headers applied to every server response (API + static files).
// Called from requestHelpers.ts (sendJson/sendText) and serveFile.ts.
import type { ServerResponse } from 'node:http';
import { FRONTEND_POLYGON_RPC_URL } from '../constants/network.ts';

// Hosts used by the Google CDN <model-viewer> script (hero 3D coin).
// model-viewer fetches Draco decoder JS/WASM from gstatic at runtime.
const MODEL_VIEWER_SCRIPT_HOST = 'https://ajax.googleapis.com';
const MODEL_VIEWER_DRACO_HOST = 'https://www.gstatic.com';

// Content-Security-Policy tells the browser what resources the page is allowed to load.
// Each directive limits a specific resource type; 'self' means same-origin only.
// Note: there is no standard `model-src` directive — .glb loads use connect-src/'self'.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'", // fallback for any directive not listed below
  "base-uri 'self'", // <base> tags can only point to our own domain
  "object-src 'none'", // block Flash/plugins entirely
  "frame-ancestors 'none'", // prevent our page from being embedded in iframes (clickjacking)
  // our bundles + model-viewer CDN + Draco helper scripts; wasm-unsafe-eval for Draco WASM
  `script-src 'self' ${MODEL_VIEWER_SCRIPT_HOST} ${MODEL_VIEWER_DRACO_HOST} 'wasm-unsafe-eval'`,
  "style-src 'self' 'unsafe-inline'", // our CSS + inline <style> tags (needed by some libs)
  "img-src 'self' data:", // images from our domain or base64 data: URLs only
  "font-src 'self' data:", // fonts from our domain or base64 data: URLs only
  // fetch/XHR: our API, Polygon RPC (must match wagmiConfig), model-viewer/Draco CDNs
  `connect-src 'self' ${FRONTEND_POLYGON_RPC_URL} ${MODEL_VIEWER_SCRIPT_HOST} ${MODEL_VIEWER_DRACO_HOST}`,
  // Draco decoder runs in a blob: worker created by model-viewer
  "worker-src 'self' blob:",
  "form-action 'self'", // forms can only submit to our own domain
].join('; ');

export function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Frame-Options', 'DENY'); // legacy iframe protection (backup for frame-ancestors)
  res.setHeader('X-Content-Type-Options', 'nosniff'); // don't guess MIME types (prevents script injection via uploads)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // send full URL on same-origin, origin-only on cross-origin
}
