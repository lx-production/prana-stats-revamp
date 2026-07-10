import { serveFile } from '../serveFile.ts';
import { fileExists } from './requestHelpers.ts';

import type { IncomingMessage, ServerResponse } from 'node:http';

export async function tryServeFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
): Promise<boolean> {
  if (!(await fileExists(filePath))) return false;
  await serveFile(req, res, filePath);
  return true;
}
