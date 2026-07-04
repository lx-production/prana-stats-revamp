import net from 'node:net';

const port = Number(process.argv[2] || process.env.API_PORT || 4174);
const host = process.env.API_HOST || '127.0.0.1';
const timeoutMs = Number(process.env.WAIT_FOR_API_TIMEOUT_MS || 30_000);
const intervalMs = 250;
const startedAt = Date.now();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canConnect() {
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

while (Date.now() - startedAt < timeoutMs) {
  if (await canConnect()) {
    console.log(`API server is ready at ${host}:${port}`);
    process.exit(0);
  }

  await sleep(intervalMs);
}

console.error(`Timed out waiting for API server at ${host}:${port}`);
process.exit(1);
