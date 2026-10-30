const { spawn } = require('child_process');
const path = require('path');

const backend = path.resolve(__dirname, '..');
const tsc = spawn(
  process.execPath,
  [path.join(backend, 'node_modules/typescript/lib/tsc.js'), '-p', 'nest/tsconfig.json', '--watch', '--preserveWatchOutput'],
  { cwd: backend, stdio: ['ignore', 'pipe', 'inherit'] },
);

let server = null;

function spawnServer() {
  server = spawn(process.execPath, ['nest/dist/main.js'], { cwd: backend, stdio: 'inherit' });
}

function start() {
  if (server && server.exitCode === null && !server.killed) {
    server.once('exit', spawnServer);
    server.kill();
    return;
  }
  spawnServer();
}

tsc.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (text.includes('Found 0 errors')) start();
});

function shutdown() {
  if (server) server.kill();
  tsc.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
