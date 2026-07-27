import crypto from 'node:crypto';
import express from 'express';

interface InternalShutdownOptions {
  token: string;
  shutdown: () => void;
}

function tokenMatches(actual: string | undefined, expected: string): boolean {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Process-private graceful-shutdown handshake for the Electron owner.
 * The random token is inherited only by the child server process; ordinary
 * localhost clients cannot terminate the app server. */
export function mountInternalShutdownRoute(
  app: express.Express,
  { token, shutdown }: InternalShutdownOptions,
): void {
  app.post('/api/internal/shutdown', (req, res) => {
    if (!tokenMatches(req.header('x-stashbase-shutdown-token'), token)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    res.status(202).json({ ok: true });
    setImmediate(shutdown);
  });
}
