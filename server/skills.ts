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
 * Idempotent — repeat calls just rewrite the target files.
 *
 * **Orphan reclamation**: when a `skills/<name>` dir is deleted, its
 * stale mirror file (`<name>.md`) is removed on the next sync. To avoid
 * destroying the user's *hand-written* CLI commands that happen to share
 * the target dir, we never delete a file we didn't write — a per-space
 * manifest (`.stashbase/skill-mirror.json`) records exactly which names
 * we mirrored, and only those whose source skill dir has fully
 * disappeared are reclaimed. A skill that's merely half-set-up (dir
 * present but missing `SKILL.md`) keeps its existing mirror.
 */
import fs from 'node:fs';
import path from 'node:path';
import { logger, errorMessage } from './log.ts';
import { noteSelfWrite } from './watcher.ts';
import { getKbRoot, resolveSpaceConfig } from './space.ts';

const log = logger('skills');

export type SyncCli = 'claude' | 'codex';

const TARGET: Record<SyncCli, string> = {
  claude: '.claude/commands',
  codex: '.codex/prompts',
};

/** Per-space record of which command files each CLI mirror owns, so a
 *  later sync can reclaim ones whose source skill is gone without
 *  touching hand-written commands. Keyed by CLI. */
const MANIFEST_REL = path.join('.stashbase', 'skill-mirror.json');

type MirrorManifest = Partial<Record<SyncCli, string[]>>;

function manifestPath(spaceRoot: string): string {
  return path.join(spaceRoot, MANIFEST_REL);
}

function readManifest(spaceRoot: string): MirrorManifest {
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath(spaceRoot), 'utf8'));
    return raw && typeof raw === 'object' ? (raw as MirrorManifest) : {};
  } catch {
    return {};
  }
}

function writeManifest(spaceRoot: string, manifest: MirrorManifest): void {
  const file = manifestPath(spaceRoot);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  } catch (err: unknown) {
    log.warn(`failed to write skill-mirror manifest: ${errorMessage(err)}`);
  }
}

export interface SkillsSyncResult {
  /** Skill names (= dir names under `skills/`) successfully mirrored. */
  synced: string[];
  /** Skill dir names found under `skills/` that didn't have a
   *  `SKILL.md` inside — surfaced so the renderer can warn the user
   *  about half-set-up skills without aborting the whole sync. */
  skipped: string[];
  /** Stale mirror files removed because their source skill dir is gone. */
  removed: string[];
}

export function syncSkillsToCli(spaceRoot: string, cli: SyncCli): SkillsSyncResult {
  const spaceName = path.relative(getKbRoot(), spaceRoot).split(path.sep).join('/');
  const cfg = resolveSpaceConfig(spaceName);

  const target = path.join(spaceRoot, TARGET[cli]);
  fs.mkdirSync(target, { recursive: true });

  const synced: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const relDir of cfg.skillsDirs) {
    const skillsDir = path.resolve(spaceRoot, relDir);
    if (!skillsDir.startsWith(spaceRoot + path.sep) && skillsDir !== spaceRoot) continue;
    let stat;
    try { stat = fs.statSync(skillsDir); } catch { continue; }
    if (!stat.isDirectory()) continue;

    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || seen.has(entry.name)) continue;
      seen.add(entry.name);
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
  }

  // Reclaim mirror files for skills that have fully disappeared. A name
  // we previously owned but that's now neither synced nor merely skipped
  // (dir still there, SKILL.md missing) is a true orphan. Skipped names
  // keep their existing mirror and stay owned.
  const manifest = readManifest(spaceRoot);
  const prevOwned = new Set(manifest[cli] ?? []);
  const stillPresent = new Set([...synced, ...skipped]);
  const removed: string[] = [];
  for (const name of prevOwned) {
    if (stillPresent.has(name)) continue;
    const orphan = path.join(target, `${name}.md`);
    try {
      noteSelfWrite(orphan);
      fs.rmSync(orphan, { force: true });
      removed.push(name);
    } catch (err: unknown) {
      log.warn(`failed to reclaim stale mirror ${orphan}: ${errorMessage(err)}`);
    }
  }

  // New ownership set: what we just wrote, plus skipped names we still
  // own a mirror for (so they remain reclaimable when truly removed).
  const owned = [...synced, ...skipped.filter((n) => prevOwned.has(n))].sort();
  writeManifest(spaceRoot, { ...manifest, [cli]: owned });

  if (synced.length > 0 || removed.length > 0) {
    log.info(
      `mirrored ${synced.length} skill(s) → ${cli}` +
        (synced.length ? `: ${synced.join(', ')}` : '') +
        (removed.length ? ` (reclaimed ${removed.length}: ${removed.join(', ')})` : ''),
    );
  }
  return { synced, skipped, removed };
}
