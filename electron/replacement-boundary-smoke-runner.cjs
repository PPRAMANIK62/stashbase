'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const { waitForChildExit } = require('./smoke-process.cjs');

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

const electronArguments = [path.join(__dirname, 'replacement-boundary-smoke.cjs')];
// GitHub's Linux hosts cannot install Electron's setuid helper. Local Linux,
// macOS, and Windows retain the process sandbox so this smoke exercises the
// effective BrowserWindow boundary whenever the host supports it.
if (process.platform === 'linux' && environment.CI === 'true') {
  electronArguments.unshift('--no-sandbox');
}

const child = spawn(
  require('electron'),
  electronArguments,
  {
    cwd: path.resolve(__dirname, '..'),
    env: environment,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  },
);

waitForChildExit(child, { launch: 'replacement-boundary', timeoutMs: 45_000 }).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
