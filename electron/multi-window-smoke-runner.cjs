'use strict';

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { buildElectronSmokeArgs } = require('./multi-window.cjs');
const { waitForChildExit } = require('./smoke-process.cjs');

const LAYOUT_SMOKE_TIMEOUT_MS = 30_000;
const WINDOW_SMOKE_TIMEOUT_MS = 75_000;

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('could not reserve smoke port'));
        return;
      }
      server.close((err) => {
        if (err) reject(err);
        else resolve(address.port);
      });
    });
  });
}

function runElectron(electronPath, script, port, smokeRoot, launch) {
  const child = spawn(electronPath, buildElectronSmokeArgs(process.platform, script, port), {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      HOME: smokeRoot,
      USERPROFILE: smokeRoot,
      LOCALAPPDATA: path.join(smokeRoot, 'local-app-data'),
      XDG_DATA_HOME: path.join(smokeRoot, 'xdg-data'),
      STASHBASE_LOCAL_DATA_ROOT: path.join(smokeRoot, 'stashbase-data'),
      STASHBASE_FOLDER_HOME: path.join(smokeRoot, 'folders'),
      STASHBASE_MULTI_WINDOW_SMOKE: '1',
      STASHBASE_SMOKE_ROOT: smokeRoot,
      STASHBASE_SMOKE_LAUNCH: String(launch),
    },
    stdio: 'inherit',
    // On POSIX this gives the watchdog an isolated process group to terminate,
    // including the server descendant. Windows uses taskkill /T instead.
    detached: process.platform !== 'win32',
  });
  const timeoutMs = launch === 'layout'
    ? LAYOUT_SMOKE_TIMEOUT_MS
    : WINDOW_SMOKE_TIMEOUT_MS;
  return waitForChildExit(child, { launch, timeoutMs });
}

async function main() {
  const electronPath = require('electron');
  const script = path.join(__dirname, 'multi-window-smoke.cjs');
  const layoutScript = path.join(__dirname, 'tab-strip-layout-smoke.cjs');
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-real-window-smoke-'));
  try {
    const port = await reservePort();
    await runElectron(electronPath, layoutScript, port, smokeRoot, 'layout');
    await runElectron(electronPath, script, port, smokeRoot, 1);
    await runElectron(electronPath, script, port, smokeRoot, 2);
    console.log(`real multi-window relaunch smoke passed on ${process.platform}`);
  } finally {
    fs.rmSync(smokeRoot, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
