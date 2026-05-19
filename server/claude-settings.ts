/**
 * Seed the space's project-local Claude Code settings so its
 * in-terminal rendering matches StashBase's light terminal panel.
 *
 * Claude Code reads (in cascade order, most-specific wins) global
 * `~/.claude/settings.json`, project-shared `<space>/.claude/settings.json`,
 * and project-local `<space>/.claude/settings.local.json`. The last
 * one is `.gitignore`-d by Claude Code's own convention, so writing
 * there is safe — it never travels with the user's repo.
 *
 * We only ever ADD a `theme` field; an existing one (any value) is
 * respected as the user's deliberate choice. A pre-existing
 * malformed file is left alone with a log warning rather than
 * overwritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { logger, errorMessage } from './log.ts';

const log = logger('claude-settings');

export function ensureLightTheme(spaceRoot: string): void {
  const dir = path.join(spaceRoot, '.claude');
  const file = path.join(dir, 'settings.local.json');
  try {
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err: unknown) {
        log.warn(`couldn't parse ${file}: ${errorMessage(err)}; leaving untouched`);
        return;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        log.warn(`existing ${file} is not a JSON object; leaving untouched`);
        return;
      }
      settings = parsed as Record<string, unknown>;
      // Respect a deliberate user choice — including `theme: "dark"`
      // if that's what they want for whatever reason.
      if ('theme' in settings) return;
    }
    fs.mkdirSync(dir, { recursive: true });
    settings.theme = 'light';
    fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
    log.info(`wrote theme=light to ${file}`);
  } catch (err: unknown) {
    log.warn(`ensureLightTheme failed for ${spaceRoot}: ${errorMessage(err)}`);
  }
}
