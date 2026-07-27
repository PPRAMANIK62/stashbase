'use strict';

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

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
  return new Promise((resolve, reject) => {
    const child = spawn(electronPath, [script, `--port=${port}`], {
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
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Electron smoke launch ${launch} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

async function main() {
  const electronPath = require('electron');
  const script = path.join(__dirname, 'multi-window-smoke.cjs');
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-real-window-smoke-'));
  try {
    const port = await reservePort();
    await runElectron(electronPath, script, port, smokeRoot, 1);
    await runElectron(electronPath, script, port, smokeRoot, 2);
    console.log(`real multi-window relaunch smoke passed on ${process.platform}`);
  } finally {
    fs.rmSync(smokeRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
