import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

export async function smokeDaemon(daemonBin, prefixArgs = []) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-smoke-py-'));
  const folderHome = path.join(tmp, 'folder-home');
  const folderRoot = path.join(folderHome, 'Smoke');
  const storeRoot = path.join(tmp, 'store');
  fs.mkdirSync(folderRoot, { recursive: true });
  const child = spawn(daemonBin, [...prefixArgs, '--store-root', storeRoot], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  const lines = createInterface({ input: child.stdout });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`daemon smoke did not finish within 20s\n${output.slice(-4_000)}`));
      }, 20_000);
      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const send = (id, op, args) => {
        child.stdin.write(`${JSON.stringify({ id, op, args })}\n`);
      };
      let closed = false;
      child.stdout.on('data', (chunk) => { output += chunk.toString(); });
      lines.on('line', (line) => {
        let msg;
        try { msg = JSON.parse(line); } catch { return; }
        if (msg.event === 'ready') {
          send(1, 'bind_folder', { folder: folderRoot, provider: 'openai', api_key: 'sk-smoke' });
          return;
        }
        if (msg.event === 'error') {
          settle(reject, new Error(`daemon error: ${msg.error}`));
          return;
        }
        if (![1, 2, 3].includes(msg.id)) return;
        if (!msg.ok) {
          settle(reject, new Error(`daemon request ${msg.id} failed: ${msg.error}\n${output.slice(-4_000)}`));
          return;
        }
        if (msg.id === 1) send(2, 'list_documents', { folder: folderRoot });
        if (msg.id === 2) {
          if (!Array.isArray(msg.result?.documents) || msg.result.documents.length !== 0) {
            settle(reject, new Error('fresh daemon folder did not return an empty document list'));
            return;
          }
          send(3, 'close_store', {});
        }
        if (msg.id === 3) {
          closed = true;
          child.stdin.end();
        }
      });
      child.stderr.on('data', (chunk) => { output += chunk.toString(); });
      child.on('error', (err) => settle(reject, err));
      child.stdin.on('error', (err) => settle(reject, err));
      child.on('exit', (code, signal) => {
        if (closed && code === 0) { settle(resolve); return; }
        settle(reject, new Error(`daemon exited before smoke completed (code=${code}, signal=${signal})\n${output.slice(-4_000)}`));
      });
    });
    console.log('[smoke] python daemon bound a folder, listed documents, and closed cleanly');
  } finally {
    lines.close();
    child.stdin.end();
    if (child.pid && child.exitCode == null && child.signalCode == null) {
      child.kill('SIGTERM');
      const killTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
      try { await exited; } finally { clearTimeout(killTimer); }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
