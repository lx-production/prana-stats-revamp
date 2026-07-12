// Dev orchestration helper: poll until the Node API server accepts TCP connections.
// Used by `npm run dev:all` so Vite starts only after `serve:dev` is listening on port 4174.
// Run: tsx scripts/wait-for-api.ts [port]
// dev runs two separate programs that must start in order; 
// prod runs one built program that already does everything

import net from 'node:net';

// CLI arg overrides API_PORT env; default matches serve:dev and config/vite.config.js proxy target.
const port = Number(process.argv[2] || process.env.API_PORT || 4174);
const host = process.env.API_HOST || '127.0.0.1';
const timeoutMs = Number(process.env.WAIT_FOR_API_TIMEOUT_MS || 30_000);
const intervalMs = 250;
const startedAt = Date.now();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Try a TCP connect; success means something is listening (the API is up).
function canConnect(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });

    socket.setTimeout(intervalMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// Poll until the port opens or we hit the timeout (exit 1 so dev:all fails visibly).
while (Date.now() - startedAt < timeoutMs) {
  if (await canConnect()) {
    console.log(`API server is ready at ${host}:${port}`);
    process.exit(0);
  }

  await sleep(intervalMs);
}

console.error(`Timed out waiting for API server at ${host}:${port}`);
process.exit(1);
