import type express from 'express';

const ALLOWED_METHODS = 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT';
const ALLOWED_HEADERS = 'content-type';
const EXPOSED_HEADERS = 'x-stashbase-file-version';

export function createRendererOriginPolicy(
  allowedOrigins: ReadonlySet<string>,
): express.RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    if (!allowedOrigins.has(origin)) {
      res.status(403).json({ error: 'cross-origin request rejected', code: 'BAD_ORIGIN' });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS);
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}
