'use strict';

const { spawn } = require('node:child_process');

const PROCESS_EXIT_GRACE_MS = 5_000;

function isChildRunning(child) {
  return Boolean(
    child
    && child.pid
    && child.exitCode === null
    && child.signalCode === null,
  );
}

function waitForTerminatedChild(child, timeoutMs = PROCESS_EXIT_GRACE_MS) {
  if (!isChildRunning(child)) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener('exit', finish);
      child.removeListener('error', finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    child.once('exit', finish);
    child.once('error', finish);
  });
}

async function terminateChildProcessTree(
  child,
  platform = process.platform,
  {
    killProcess = process.kill,
    spawnProcess = spawn,
  } = {},
) {
  if (!isChildRunning(child)) return;

  if (platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawnProcess(
        'taskkill',
        ['/pid', String(child.pid), '/T', '/F'],
        { stdio: 'ignore', windowsHide: true },
      );
      killer.once('error', resolve);
      killer.once('exit', resolve);
    });
  } else {
    // The runner starts Electron as a detached process-group leader on POSIX,
    // so a negative PID terminates Electron and its server descendants.
    try {
      killProcess(-child.pid, 'SIGKILL');
    } catch (err) {
      if (err?.code !== 'ESRCH') throw err;
      child.kill('SIGKILL');
    }
  }

  await waitForTerminatedChild(child);
}

function waitForChildExit(
  child,
  {
    launch,
    timeoutMs,
    terminate = terminateChildProcessTree,
  },
) {
  return new Promise((resolve, reject) => {
    let state = 'pending';

    const cleanup = () => {
      clearTimeout(timer);
      child.removeListener('error', onError);
      child.removeListener('exit', onExit);
    };
    const settle = (handler, value) => {
      if (state !== 'pending') return;
      state = 'settled';
      cleanup();
      handler(value);
    };
    const onError = (err) => {
      settle(reject, err);
    };
    const onExit = (code, signal) => {
      if (code === 0) {
        settle(resolve);
        return;
      }
      settle(
        reject,
        new Error(`Electron smoke launch ${launch} failed (${signal ?? `exit ${code}`})`),
      );
    };
    const timer = setTimeout(async () => {
      if (state !== 'pending') return;
      state = 'terminating';
      const timeoutError = new Error(
        `Electron smoke launch ${launch} timed out after ${timeoutMs}ms`,
      );
      try {
        await terminate(child);
      } catch (err) {
        timeoutError.cause = err;
      } finally {
        cleanup();
        state = 'settled';
        reject(timeoutError);
      }
    }, timeoutMs);

    child.once('error', onError);
    child.once('exit', onExit);
  });
}

module.exports = {
  terminateChildProcessTree,
  waitForChildExit,
};
