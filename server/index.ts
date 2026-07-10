import { env } from 'process';
import { createServer } from 'http';
import { sendJson } from './helpers/requestHelpers.ts';
import { warmApiCaches } from './serverStartup.ts';
import { handleStaticRequest } from './staticRoutes.ts';
import { createGetApiRouteHandler } from './getApiRoutes.ts';
import { createSwapRateLimiters } from './rateLimit.ts';
import { createPostApiRouteHandler } from './postApiRoutes.ts';

const PORT = Number(env.PORT ?? 4173);
const HOST = env.HOST ?? '127.0.0.1';

const rateLimiters = createSwapRateLimiters();

// Split API handlers: readonly GET routes vs POST-only swap routes
const handleGetApiRequest = createGetApiRouteHandler();
const handlePostApiRequest = createPostApiRouteHandler(rateLimiters);

rateLimiters.startCleanupTimer();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Try GET API routes first, then POST swap routes, then static files
    if (await handleGetApiRequest(req, res, url)) return;
    if (await handlePostApiRequest(req, res, url)) return;
    if (await handleStaticRequest(req, res, url)) return;

    sendJson(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: 'internal_error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
  void warmApiCaches();
});
