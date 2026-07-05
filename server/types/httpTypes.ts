import type { IncomingMessage, ServerResponse } from 'node:http';

export type RequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => Promise<boolean>;
