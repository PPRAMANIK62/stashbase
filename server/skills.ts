/**
 * Mirror `skills/<name>/SKILL.md` (the user's single source of truth)
 * into whichever CLI-specific directory the user is currently using:
 *
 *   skills/digest/SKILL.md     → .claude/commands/digest.md  (Claude Code)
 *                              → .codex/prompts/digest.md   (Codex)
 *
 * Fired by the renderer whenever the terminal panel mounts / the user
 * switches CLI (TerminalPane's `[space, currentCliId]` effect). Lets
 * users define a slash command once under `skills/` and have it work
 * across CLI tools without copy-pasting per-CLI.
 *
 * Idempotent — repeat calls just rewrite the target files. Files in
 * the target dir that don't correspond to any `skills/<name>` entry
 * are left alone, so manually-written CLI-specific commands aren't
 * destroyed by the mirror.
 */
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './log.ts';
import { noteSelfWrite } from './watcher.ts';

const log = logger('skills');

export type SyncCli = 'claude' | 'codex';

const TARGET: Record<SyncCli, string> = {
  claude: '.claude/commands',
  codex: '.codex/prompts',
};

export interface SkillsSyncResult {
  /** Skill names (= dir names under `skills/`) successfully mirrored. */
  synced: string[];
  /** Skill dir names found under `skills/` that didn't have a
   *  `SKILL.md` inside — surfaced so the renderer can warn the user
   *  about half-set-up skills without aborting the whole sync. */
  skipped: string[];
}

export function syncSkillsToCli(spaceRoot: string, cli: SyncCli): SkillsSyncResult {
  const skillsDir = path.join(spaceRoot, 'skills');
  let stat;
  try { stat = fs.statSync(skillsDir); } catch { return { synced: [], skipped: [] }; }
  if (!stat.isDirectory()) return { synced: [], skipped: [] };

  const target = path.join(spaceRoot, TARGET[cli]);
  fs.mkdirSync(target, { recursive: true });

  const synced: string[] = [];
  const skipped: string[] = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    let content: string;
    try { content = fs.readFileSync(skillFile, 'utf8'); }
    catch { skipped.push(entry.name); continue; }
    const targetFile = path.join(target, `${entry.name}.md`);
    // Avoid the watcher round-tripping this back as an "external" event.
    noteSelfWrite(targetFile);
    fs.writeFileSync(targetFile, content, 'utf8');
    synced.push(entry.name);
  }
  if (synced.length > 0) {
    log.info(`mirrored ${synced.length} skill(s) → ${cli}: ${synced.join(', ')}`);
  }
  return { synced, skipped };
}
