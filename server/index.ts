import { createServer } from 'http';
import { env } from 'process';
import { createApiRouteHandler } from './apiRoutes.ts';
import { createSwapRateLimiters } from './rateLimit.ts';
import { sendJson } from './requestHelpers.ts';
import { warmApiCaches } from './serverStartup.ts';
import { handleStaticRequest } from './staticRoutes.ts';

const PORT = Number(env.PORT ?? 4173);
const HOST = env.HOST ?? '127.0.0.1';

const rateLimiters = createSwapRateLimiters();
const handleApiRequest = createApiRouteHandler(rateLimiters);

rateLimiters.startCleanupTimer();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (await handleApiRequest(req, res, url)) return;
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
