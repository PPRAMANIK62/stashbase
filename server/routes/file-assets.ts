import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeHtml } from '../html.ts';
import { resolveAsset, resolveExisting } from '../files.ts';
import { detectViewerFormat } from '../format.ts';
import { derivedHtmlPathForDocx } from '../docx.ts';
import { getScheduledConversion, isConversionTextUnavailable } from '../conversion.ts';
import { hasFailed } from '../conversion-status.ts';
import { filesystemPath } from '../filesystem-path.ts';
import { toSourcePath } from '../folder.ts';
import { sendError } from '../http.ts';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

export function mountFileAssetRoutes(app: express.Express): void {
  // HTML responses carry heading ids and the scroll bootstrap. Video uses
  // sendFile for Range support; other assets stream with an explicit MIME.
  app.get('/asset/*', (req, res) => {
    const rel = stripAssetWindowPrefix((req.params as any)[0] as string);
    const abs = resolveAsset(rel);
    if (!abs) return res.status(404).end();
    const ext = path.extname(abs).toLowerCase();
    if (ext === '.html' || ext === '.htm') {
      try {
        const raw = fs.readFileSync(abs, 'utf8');
        const { preparedHtml } = analyzeHtml(raw);
        res.type('text/html').send(preparedHtml);
      } catch (err: unknown) {
        sendError(res, err);
      }
      return;
    }
    if (ext === '.webm' || ext === '.mp4' || ext === '.mov' || ext === '.m4v') {
      return res.sendFile(abs);
    }
    res.type(MIME[ext] ?? 'application/octet-stream');
    fs.createReadStream(abs).pipe(res);
  });

  // Derived DOCX HTML is a fallback when renderer-side conversion cannot
  // produce the immediate preview. The visible DOCX stays the source path.
  app.get('/asset-derived/*', (req, res) => {
    const rel = stripAssetWindowPrefix((req.params as any)[0] as string);
    if (detectViewerFormat(rel) !== 'docx') return res.status(415).end();
    let sourceAbs: string | null = null;
    try {
      sourceAbs = resolveExisting(rel);
      if (!sourceAbs) return res.status(404).end();
      if (isConversionTextUnavailable(sourceAbs)) throw new Error('document conversion unavailable');
      const htmlAbs = derivedHtmlPathForDocx(sourceAbs);
      const raw = fs.readFileSync(htmlAbs, 'utf8');
      const { preparedHtml } = analyzeHtml(raw);
      res.type('text/html').send(preparedHtml);
    } catch {
      let sourcePath: string | null = sourceAbs ? filesystemPath.absolute(sourceAbs) : null;
      if (!sourcePath) {
        try { sourcePath = toSourcePath(rel); } catch { /* no active folder context */ }
      }
      const scheduled = sourcePath ? getScheduledConversion(sourcePath) : null;
      let failed = false;
      if (sourcePath) {
        try { failed = hasFailed(sourcePath); }
        catch { /* preparation status is auxiliary */ }
      }
      let message = 'Preparing document preview…';
      if (failed) {
        message = 'Document preparation failed. Use Reprocess to try again.';
      } else if (scheduled?.state === 'queued') {
        const ahead = scheduled.tasksAhead ?? 0;
        message = ahead > 0
          ? `Waiting for document conversion — ${ahead} light-lane task${ahead === 1 ? '' : 's'} ahead.`
          : 'Waiting for document conversion…';
      }
      res.status(409).type('text/html').send(
        `<!doctype html><meta charset="utf-8"><body>${message}</body>`,
      );
    }
  });
}

function stripAssetWindowPrefix(rel: string): string {
  if (!rel.startsWith('__window/')) return rel;
  const slash = rel.indexOf('/', '__window/'.length);
  return slash >= 0 ? rel.slice(slash + 1) : '';
}
