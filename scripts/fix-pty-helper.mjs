#!/usr/bin/env node
/**
 * `node-pty` ships its `spawn-helper` prebuild binary without the
 * execute bit on POSIX platforms (tar-stream lossage during npm pack).
 * Without `x`, `posix_spawnp` fails immediately with the unhelpful
 * "posix_spawnp failed." error the moment a terminal is opened.
 *
 * Run automatically as a `postinstall` step so a fresh `pnpm install`
 * doesn't leave us with a broken terminal. Idempotent — no-op when
 * the file already has the bit set, or when it doesn't exist on this
 * platform (Windows builds don't ship `spawn-helper`).
 */
import { chmodSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.join(here, '..', 'node_modules', 'node-pty', 'prebuilds', 'darwin-arm64', 'spawn-helper'),
  path.join(here, '..', 'node_modules', 'node-pty', 'prebuilds', 'darwin-x64', 'spawn-helper'),
  path.join(here, '..', 'node_modules', 'node-pty', 'prebuilds', 'linux-arm64', 'spawn-helper'),
  path.join(here, '..', 'node_modules', 'node-pty', 'prebuilds', 'linux-x64', 'spawn-helper'),
];

for (const p of candidates) {
  let mode;
  try { mode = statSync(p).mode; } catch { continue; }
  if (mode & 0o111) continue; // already executable on at least one bit
  try {
    chmodSync(p, 0o755);
    process.stdout.write(`fix-pty-helper: chmod +x ${path.relative(process.cwd(), p)}\n`);
  } catch (err) {
    process.stderr.write(`fix-pty-helper: failed to chmod ${p}: ${err.message}\n`);
  }
}
