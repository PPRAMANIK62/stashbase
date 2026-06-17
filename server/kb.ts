/**
 * KB-level rules + orientation.
 *
 * `STASHBASE.md` is the maintenance "rules book" an AI assistant follows
 * when working in the knowledge base. It exists at the KB root
 * (`<kbRoot>/STASHBASE.md`, the baseline) and optionally per space
 * (`<space>/STASHBASE.md`, layered on top). It is plain user-authored
 * markdown — no schema — and is intentionally kept in the search index.
 *
 * `getKbInfo()` is the agent's orientation card: where the KB lives, what
 * spaces exist, and the rules. Everything else (reading/writing notes,
 * listing files) the agent does with its own filesystem tools under
 * `kb_root`; semantic facts come from `search_kb`.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getKbRoot, listKnownSpaces } from './space.ts';
import { getEmbedderProvider } from './app-config.ts';

const RULES_FILENAME = 'STASHBASE.md';

function kbRulesPath(): string {
  return path.join(getKbRoot(), RULES_FILENAME);
}

export function getKbRules(): string {
  try { return fs.readFileSync(kbRulesPath(), 'utf8'); } catch { return ''; }
}

export function kbRulesVersion(): string | null {
  try {
    const st = fs.statSync(kbRulesPath());
    if (!st.isFile()) return null;
    return `${st.dev}:${st.ino}:${st.ctimeMs}:${st.mtimeMs}:${st.size}`;
  } catch {
    return null;
  }
}

export function setKbRules(content: string, opts: { baseVersion?: string } = {}): string | null {
  if (opts.baseVersion !== undefined) {
    const currentVersion = kbRulesVersion();
    if (currentVersion !== opts.baseVersion) {
      const err = new Error('KB rules changed on disk; reload before saving');
      (err as any).code = 'FILE_CHANGED';
      (err as any).currentVersion = currentVersion;
      throw err;
    }
  }
  const target = kbRulesPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, target);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best-effort */ }
    throw err;
  }
  return kbRulesVersion();
}

export interface KbInfo {
  /** Absolute filesystem path of the knowledge base — agents do all file
   *  CRUD with their own tools under this root. */
  kb_root: string;
  /** KB-level maintenance rules from `<kbRoot>/STASHBASE.md`. */
  rules: string;
  /** Spaces present in the KB. Just identity + provider — agents list files
   *  themselves under `kb_root`; semantic facts come from `search_kb`. */
  spaces: Array<{ name: string; provider: 'openai' }>;
}

/** The agent's orientation card: where the KB lives, what spaces exist,
 *  and the rules. No daemon call — agents enumerate files themselves under
 *  `kb_root`; semantic facts come from `search_kb`. */
export function getKbInfo(): KbInfo {
  const provider = getEmbedderProvider();
  return {
    kb_root: getKbRoot(),
    rules: getKbRules(),
    spaces: listKnownSpaces().map((name) => ({ name, provider })),
  };
}
