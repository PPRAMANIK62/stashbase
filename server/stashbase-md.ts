/**
 * Mirror the merged StashBase maintenance rules (KB-level `STASHBASE.md`
 * + the space's own `STASHBASE.md`, KB first) into the CLI-native rules
 * files a coding agent reads automatically:
 *
 *   <space>/CLAUDE.md   (Claude Code)
 *   <space>/AGENTS.md   (Codex / generic agents)
 *
 * Fired by the same trigger as skill mirroring (terminal panel mount /
 * CLI switch — see `syncSkillsToCli`). Lets a user keep one source of
 * truth in `STASHBASE.md` and have it picked up by whatever CLI agent
 * they run inside the space.
 *
 * Only the region between the marker comments is owned by StashBase:
 *
 *   <!-- stashbase:begin -->
 *   …merged rules…
 *   <!-- stashbase:end -->
 *
 * Existing content outside the markers is never touched. If a file
 * already has the marker pair, the block is replaced in place;
 * otherwise the block is prepended (followed by a blank line) so the
 * user's own CLAUDE.md / AGENTS.md content is preserved below it.
 *
 * Empty-rules behaviour: when the merged rules are empty we still write
 * an empty marked block. This keeps the markers anchored (so a later
 * non-empty sync replaces in place rather than prepending a second
 * block) and makes the "StashBase manages this region" contract
 * visible even before any rules exist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { logger, errorMessage } from './log.ts';
import { noteSelfWrite } from './watcher.ts';
import { getKbRoot } from './space.ts';
import { getResolvedRules } from './library.ts';

const log = logger('stashbase-md');

const BEGIN = '<!-- stashbase:begin -->';
const END = '<!-- stashbase:end -->';

/** Files we mirror the merged rules into, relative to the space root. */
const TARGETS = ['CLAUDE.md', 'AGENTS.md'];

/** Build the marked block (markers always present, body may be empty). */
function markedBlock(rules: string): string {
  const body = rules.trim();
  return body ? `${BEGIN}\n${body}\n${END}` : `${BEGIN}\n${END}`;
}

/** Replace an existing marked block in `existing`, or prepend a fresh
 *  one. Content outside the markers is preserved verbatim. */
function applyBlock(existing: string, block: string): string {
  const begin = existing.indexOf(BEGIN);
  const end = existing.indexOf(END);
  if (begin !== -1 && end !== -1 && end > begin) {
    const before = existing.slice(0, begin);
    const after = existing.slice(end + END.length);
    return before + block + after;
  }
  // No marker pair — prepend the block, blank line, then the original.
  return existing.length > 0 ? `${block}\n\n${existing}` : `${block}\n`;
}

/** Mirror the merged rules for `spaceRoot`'s space into its CLAUDE.md /
 *  AGENTS.md. Best-effort per file: a write failure on one is logged and
 *  doesn't abort the other. */
export function mirrorRulesToCli(spaceRoot: string): void {
  const spaceName = path.relative(getKbRoot(), spaceRoot).split(path.sep).join('/');
  const block = markedBlock(getResolvedRules(spaceName));
  for (const name of TARGETS) {
    const target = path.join(spaceRoot, name);
    let existing = '';
    try { existing = fs.readFileSync(target, 'utf8'); } catch { /* new file */ }
    const next = applyBlock(existing, block);
    if (next === existing) continue; // nothing changed — skip the write + watcher churn
    try {
      // Mark before write so the fs watcher swallows the resulting event
      // instead of treating it as an external edit and re-syncing.
      noteSelfWrite(target);
      fs.writeFileSync(target, next, 'utf8');
    } catch (err: unknown) {
      log.warn(`mirror rules → ${target} failed: ${errorMessage(err)}`);
    }
  }
}
