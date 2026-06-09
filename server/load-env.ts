/**
 * Load a repo-root `.env` (KEY=VALUE per line) into `process.env` as a
 * dev convenience, so flags like `STASHBASE_RECORDING_DEBUG=1` can live in
 * a file instead of being prefixed on every launch.
 *
 * Imported FIRST in `index.ts` (before any module that reads env at import
 * time, e.g. `log.ts`'s `STASHBASE_LOG`). Precedence: a shell-set var
 * always wins — we never overwrite a key already present in `process.env`,
 * so `STASHBASE_X=… pnpm dev` still overrides the file. Silently no-ops
 * when there's no `.env` (the packaged app ships none — resolution lands
 * on a nonexistent `dist/.env`).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;               // comments (#…) and blanks don't match
    const key = m[1];
    if (key in process.env) continue; // shell wins; never clobber
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
} catch {
  // No .env (or unreadable) — fine, everything stays optional.
}
