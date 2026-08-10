/**
 * Agent CLI registry + binary probe. The supported CLIs (Claude Code,
 * Codex) are enumerated here with their install hints and a cheap
 * on-PATH check; the chat panel surfaces them via `/api/terminal/clis`.
 *
 * The CLIs themselves run through structured agent bridges (Claude Agent
 * SDK in server/agent.ts, Codex app-server in server/codex-agent.ts),
 * not a PTY — this module no longer bridges a shell.
 */
import { spawnSync } from 'node:child_process';

/** Per-platform login shell, used by the on-PATH probe below. POSIX
 *  honours `$SHELL` (covers bash / fish / nu / etc.) with a zsh fallback
 *  for the rare case where the env var is unset. Windows ignores
 *  `$SHELL` entirely and uses `ComSpec` — falling back to PowerShell
 *  only if even that's missing (no user-overridable env var on
 *  Windows). */
function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/zsh';
}

/** Registry of supported AI CLIs. Adding a new one = one entry here +
 *  it surfaces in the renderer's launchers automatically. `installHint`
 *  is the copy-paste command shown when the binary is missing; `bin` is
 *  what we probe on PATH. */
export interface CliDef {
  id: string;
  label: string;
  vendor: string;
  bin: string;           // PATH name we probe
  /** Argv that would be appended after `bin` to launch the CLI. Retained
   *  in the registry so `/api/terminal/clis` can expose a full launch
   *  command, though the structured chat panel doesn't shell out. */
  launchArgs: string[];
  install: string[];     // argv for `npm install -g ...` style invocation
  installHint: string;   // human-readable install command
}

export const CLIS: Record<string, CliDef> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    vendor: 'Anthropic',
    bin: 'claude',
    // No launch flags — Claude Code doesn't accept `--theme` on the
    // CLI. Its theme lives in `~/.claude/settings.json` (or the
    // project-local `.claude/settings.local.json`) and is also
    // switchable in-app via the `/theme` slash command.
    launchArgs: [],
    install: ['install', '-g', '@anthropic-ai/claude-code'],
    installHint: 'npm install -g @anthropic-ai/claude-code',
  },
  codex: {
    id: 'codex',
    label: 'Codex',
    vendor: 'OpenAI',
    bin: 'codex',
    // Codex doesn't yet expose a CLI-level theme flag; it (mostly)
    // honours COLORFGBG from the spawn env. Track upstream and add
    // a flag here if/when one appears.
    launchArgs: [],
    install: ['install', '-g', '@openai/codex'],
    installHint: 'npm install -g @openai/codex',
  },
};

/** Full shell command that would launch a CLI: `<bin> <args…>`.
 *  Surfaced via `/api/terminal/clis` for completeness. */
export function launchCommandFor(cli: CliDef): string {
  return [cli.bin, ...cli.launchArgs].join(' ');
}

/** Check whether a given CLI's binary is on PATH. On Windows, use
 *  `where.exe` because `command -v` is a POSIX shell builtin. On POSIX,
 *  run `command -v <bin>` in the user's login + INTERACTIVE shell so
 *  PATH additions from `.zshrc` / `.bashrc` (where nvm, pyenv, rbenv,
 *  asdf and most version-manager bootstraps actually live) are
 *  sourced. `-l` alone is non-interactive, which on macOS only reads
 *  `.zprofile` / `.profile`, missing the npm-global PATH that most
 *  users install Claude Code into. Bounded by a 5s timeout so a
 *  pathologically slow rc file can't deadlock the request. */
export function checkCliInstalled(id: string): boolean {
  const cli = CLIS[id];
  if (!cli) return false;
  if (process.platform === 'win32') {
    try {
      const r = spawnSync('where.exe', [cli.bin], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return r.status === 0 && r.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }
  const shell = defaultShell();
  try {
    const r = spawnSync(shell, ['-l', '-i', '-c', `command -v ${cli.bin}`], {
      encoding: 'utf8',
      timeout: 5000,
      // Close stdin — an interactive shell that tries to read (rare
      // .zshrc patterns: `read -k`, `vared`, etc.) would otherwise
      // hang for the full timeout.
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return r.status === 0 && r.stdout.trim().length > 0;
  } catch {
    return false;
  }
}
