/**
 * HTTP-layer helpers used by every route module: error envelope,
 * space-open gate, OpenAI-key validator, and the OS file-manager
 * spawn (used by the reveal route).
 *
 * Kept separate from the route files so they can be imported without
 * pulling in Express route registration side effects.
 */
import express from 'express';
import childProcess from 'node:child_process';
import path from 'node:path';
import { logger, errorMessage, errorCode } from './log.ts';
import { getCurrentSpace } from './space.ts';

const log = logger('http');

/** Standard error envelope: `{ error: string, code?: string }` with an
 *  HTTP status code chosen by the situation. `NO_SPACE` translates a
 *  thrown `requireCurrentSpace` failure from the files layer into the
 *  conventional 412 the client expects. */
export function sendError(res: express.Response, err: unknown): void {
  if (errorCode(err) === 'NO_SPACE') {
    res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
    return;
  }
  res.status(500).json({ error: errorMessage(err) });
}

/** Express middleware: 412 when no space is currently open. Mounted on
 *  the path prefixes (/api/files, /api/folders, /api/search, …) that
 *  rely on `getCurrentSpace()` returning a value. Routes that work
 *  before a space is open (welcome screen) stay outside the prefix. */
export const requireSpace: express.RequestHandler = (_req, res, next) => {
  if (!getCurrentSpace()) {
    return res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
  }
  next();
};

export type OpenAIKeyCheck = { ok: true } | { ok: false; status: number; error: string };

/** Probe an OpenAI key against `/v1/models` — cheapest unauth check
 *  (no embed credits consumed). Single source of truth so the validate
 *  route, key-rotate route, and any future caller share the same
 *  network / parsing behaviour. `status` carries the HTTP status the
 *  caller should respond with: 400 when OpenAI rejected the key, 502
 *  when we couldn't reach OpenAI at all. */
export async function validateOpenAIKey(key: string): Promise<OpenAIKeyCheck> {
  try {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (r.ok) return { ok: true };
    const detail = await r.text().catch(() => '');
    return {
      ok: false,
      status: 400,
      error: `OpenAI rejected the key (HTTP ${r.status}): ${detail.slice(0, 200)}`,
    };
  } catch (err: unknown) {
    return { ok: false, status: 502, error: `network: ${errorMessage(err)}` };
  }
}

/** Open the OS file manager focused on the given absolute path. macOS
 *  `open -R` selects the file in Finder; Windows uses `explorer /select`;
 *  Linux falls back to opening the containing directory since most
 *  desktops don't have a portable "reveal one file" command. */
export function revealInOsFileManager(absPath: string): void {
  let cmd: string;
  let args: string[];
  if (process.platform === 'darwin') {
    cmd = 'open';
    args = ['-R', absPath];
  } else if (process.platform === 'win32') {
    cmd = 'explorer.exe';
    args = [`/select,${absPath}`];
  } else {
    cmd = 'xdg-open';
    args = [path.dirname(absPath)];
  }
  const proc = childProcess.spawn(cmd, args, { detached: true, stdio: 'ignore' });
  proc.on('error', (err) => {
    log.warn(`reveal: spawn ${cmd} failed: ${err.message}`);
  });
  proc.unref();
}
