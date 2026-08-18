/**
 * On-demand installation coordinator for application-scoped Agent runtimes.
 *
 * The coordinator is intentionally dependency-injected so the New Chat
 * bootstrap state machine can be tested without downloading a 300 MB binary,
 * touching provider credentials, or rewriting a real MCP config.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import {
  consumeAgentSetupFailure,
  managedAgentExecutable,
  managedAgentRuntimeRoot,
  managedClaudeReleasesDir,
  managedCodexBinDir,
  managedCodexInstallerHome,
  writeManagedClaudeManifest,
  type ManagedAgentId,
} from './agent-runtime-paths.ts';
import { ensureAgentMcp } from './agent-mcp.ts';
import { resolveAgentCli, resolveAgentCliWithLoginShell } from './agent-cli.ts';
import { terminateExtractorTree as terminateInstallerTree } from './extractor-process.ts';
import type {
  AgentBootstrapFailureCode,
  AgentBootstrapFailureStage,
  AgentBootstrapManualRecovery,
  AgentBootstrapStatus,
} from '../shared/agent-runtime.ts';

export type {
  AgentBootstrapFailure,
  AgentBootstrapFailureCode,
  AgentBootstrapFailureStage,
  AgentBootstrapManualRecovery,
  AgentBootstrapPhase,
  AgentBootstrapStatus,
} from '../shared/agent-runtime.ts';

type ProgressUpdate = Pick<AgentBootstrapStatus, 'progress' | 'message'>;

export interface AgentBootstrapDependencies {
  resolveExecutable(id: ManagedAgentId, options?: { probeLoginShell?: boolean }): string | null;
  installRuntime(id: ManagedAgentId, update: (next: ProgressUpdate) => void, signal: AbortSignal): Promise<void>;
  configureMcp(id: ManagedAgentId): void;
  consumeFailure(stage: 'installation' | 'mcp'): boolean;
}

const IDLE_STATUS: AgentBootstrapStatus = { phase: 'idle' };

export class AgentBootstrapCoordinator {
  private readonly statuses = new Map<ManagedAgentId, AgentBootstrapStatus>();
  private readonly controllers = new Map<ManagedAgentId, AbortController>();
  private readonly runs = new Map<ManagedAgentId, Promise<void>>();

  constructor(private readonly dependencies: AgentBootstrapDependencies) {}

  status(id: ManagedAgentId): AgentBootstrapStatus {
    return this.statuses.get(id) ?? IDLE_STATUS;
  }

  begin(id: ManagedAgentId): AgentBootstrapStatus {
    if (this.runs.has(id)) return this.status(id);
    let executable: string | null;
    try {
      executable = this.dependencies.resolveExecutable(id, { probeLoginShell: true });
    } catch (error) {
      this.fail(id, 'discovery', 'operation-failed', error);
      return this.status(id);
    }
    if (executable) {
      this.configure(id);
      return this.status(id);
    }

    if (this.dependencies.consumeFailure('installation')) {
      this.fail(id, 'installation', 'simulated', new Error('Simulated Agent installation failure.'));
      return this.status(id);
    }

    const controller = new AbortController();
    this.controllers.set(id, controller);
    this.statuses.set(id, { phase: 'installing', progress: 0, message: `Preparing ${agentLabel(id)}…` });
    const run = (async () => {
      // Yield once so `runs` owns the promise before even a simulated or
      // synchronous installer failure reaches the cleanup block.
      await Promise.resolve();
      try {
        await this.dependencies.installRuntime(id, (next) => {
          this.statuses.set(id, { phase: 'installing', ...next });
        }, controller.signal);
      } catch (error) {
        this.fail(id, 'installation', 'operation-failed', error, 'install-command');
        return;
      }
      let installedExecutable: string | null;
      try {
        installedExecutable = this.dependencies.resolveExecutable(id);
      } catch (error) {
        this.fail(id, 'installation', 'operation-failed', error, 'install-command');
        return;
      }
      if (!installedExecutable) {
        this.fail(
          id,
          'installation',
          'runtime-unavailable',
          new Error(`${agentLabel(id)} installation finished without a usable executable.`),
          'install-command',
        );
        return;
      }
      this.statuses.set(id, { phase: 'configuring', progress: 1, message: 'Connecting StashBase MCP…' });
      this.configure(id);
    })().finally(() => {
      this.controllers.delete(id);
      this.runs.delete(id);
    });
    this.runs.set(id, run);
    return this.status(id);
  }

  private configure(id: ManagedAgentId, allowSimulation = true): void {
    if (allowSimulation && this.dependencies.consumeFailure('mcp')) {
      this.fail(id, 'mcp', 'simulated', new Error('Simulated MCP configuration failure.'));
      return;
    }
    try {
      this.dependencies.configureMcp(id);
      this.statuses.set(id, { phase: 'ready', progress: 1, message: `${agentLabel(id)} is ready.` });
    } catch (error) {
      this.fail(id, 'mcp', 'operation-failed', error, 'mcp-settings');
    }
  }

  /** App startup may repair MCP for runtimes it can already discover, but it
   * must never turn discovery into an implicit download. The synchronous
   * boot pass skips login-shell probing so listen stays quick; a deferred
   * post-boot pass repeats it WITH the probe (see
   * `connectInstalledAgentMcpAfterBoot`), so a system runtime that only a
   * login shell can resolve still auto-connects without waiting for the
   * first New Chat. */
  connectIfInstalled(id: ManagedAgentId, options?: { probeLoginShell?: boolean }): AgentBootstrapStatus {
    if (this.runs.has(id)) return this.status(id);
    let executable: string | null;
    try {
      executable = this.dependencies.resolveExecutable(id, options);
    } catch (error) {
      this.fail(id, 'discovery', 'operation-failed', error);
      return this.status(id);
    }
    if (!executable) return this.status(id);
    // Startup repair is background maintenance, not the explicit setup action
    // targeted by the development `nextFailure` control.
    this.configure(id, false);
    return this.status(id);
  }

  async reset(id: ManagedAgentId): Promise<void> {
    this.controllers.get(id)?.abort();
    await this.runs.get(id);
    this.statuses.delete(id);
  }

  async wait(id: ManagedAgentId): Promise<AgentBootstrapStatus> {
    await this.runs.get(id);
    return this.status(id);
  }

  async cancelAll(): Promise<ManagedAgentId[]> {
    const ids = [...this.runs.keys()];
    for (const id of ids) this.controllers.get(id)?.abort();
    await Promise.allSettled(ids.map((id) => this.runs.get(id)));
    return ids;
  }

  private fail(
    id: ManagedAgentId,
    stage: AgentBootstrapFailureStage,
    code: AgentBootstrapFailureCode,
    error: unknown,
    manualRecovery?: AgentBootstrapManualRecovery,
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    this.statuses.set(id, {
      phase: 'failed',
      failure: {
        stage,
        code,
        message: message.slice(0, 1000),
        retryable: true,
        manualRecovery,
      },
    });
  }
}

function agentLabel(id: ManagedAgentId): string {
  return id === 'codex' ? 'Codex' : 'Claude Code';
}

function resolveManagedOrSystemExecutable(
  id: ManagedAgentId,
  options?: { probeLoginShell?: boolean },
): string | null {
  const resolver = options?.probeLoginShell ? resolveAgentCliWithLoginShell : resolveAgentCli;
  return resolver(id === 'codex'
    ? { name: 'codex', envNames: ['STASHBASE_CODEX_BIN', 'CODEX_CLI_BIN', 'CODEX_CLI_PATH'], logLabel: 'Codex' }
    : { name: 'claude', envNames: ['STASHBASE_CLAUDE_BIN', 'CLAUDE_CODE_BIN'], logLabel: 'Claude Code' });
}

export const agentBootstrapCoordinator = new AgentBootstrapCoordinator({
  resolveExecutable: resolveManagedOrSystemExecutable,
  installRuntime: installManagedRuntime,
  configureMcp: (id) => { ensureAgentMcp(id); },
  consumeFailure: consumeAgentSetupFailure,
});

export function agentBootstrapStatus(id: ManagedAgentId): AgentBootstrapStatus {
  return agentBootstrapCoordinator.status(id);
}

export function beginAgentBootstrap(id: ManagedAgentId): AgentBootstrapStatus {
  return agentBootstrapCoordinator.begin(id);
}

export function connectInstalledAgentMcpOnStartup(): Array<{ id: ManagedAgentId; status: AgentBootstrapStatus }> {
  return (['codex', 'claude'] as const).map((id) => ({
    id,
    status: agentBootstrapCoordinator.connectIfInstalled(id),
  }));
}

/** The deferred second startup pass, WITH the login-shell probe: system
 * runtimes that only a login shell can resolve (nvm/homebrew paths) still
 * auto-connect shortly after boot instead of waiting for the first New
 * Chat. Runs off the listen path — the probe spawns a shell. */
export function connectInstalledAgentMcpAfterBoot(): Array<{ id: ManagedAgentId; status: AgentBootstrapStatus }> {
  return (['codex', 'claude'] as const).map((id) => ({
    id,
    status: agentBootstrapCoordinator.connectIfInstalled(id, { probeLoginShell: true }),
  }));
}

export function resetAgentBootstrap(id: ManagedAgentId): Promise<void> {
  return agentBootstrapCoordinator.reset(id);
}

export function cancelAgentRuntimeInstalls(): Promise<ManagedAgentId[]> {
  return agentBootstrapCoordinator.cancelAll();
}

export function claudePlatform(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
  musl = platform === 'linux' && isMuslLinux(),
): string {
  const normalizedArch = arch === 'arm64' ? 'arm64' : arch === 'x64' ? 'x64' : '';
  if (!normalizedArch || !['darwin', 'linux', 'win32'].includes(platform)) {
    throw new Error(`Claude Code does not publish a managed runtime for ${platform}/${arch}.`);
  }
  return `${platform}-${normalizedArch}${platform === 'linux' && musl ? '-musl' : ''}`;
}

function isMuslLinux(): boolean {
  if (process.platform !== 'linux') return false;
  if (fs.existsSync('/lib/libc.musl-x86_64.so.1') || fs.existsSync('/lib/libc.musl-aarch64.so.1')) return true;
  try {
    const report = process.report?.getReport() as { header?: { glibcVersionRuntime?: string } };
    return !report.header?.glibcVersionRuntime;
  } catch {
    return false;
  }
}

async function installManagedRuntime(
  id: ManagedAgentId,
  update: (next: ProgressUpdate) => void,
  signal: AbortSignal,
): Promise<void> {
  if (id === 'claude') return installClaude(update, signal);
  return installCodex(update, signal);
}

const CLAUDE_RELEASES = 'https://downloads.claude.ai/claude-code-releases';

interface ClaudeManifest {
  version: string;
  platforms: Record<string, { binary: string; checksum: string; size: number }>;
}

async function installClaude(update: (next: ProgressUpdate) => void, signal: AbortSignal): Promise<void> {
  update({ progress: 0, message: 'Resolving the latest Claude Code release…' });
  const version = (await fetchBoundedText(`${CLAUDE_RELEASES}/latest`, signal, 200)).trim();
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) {
    throw new Error('Claude Code returned an invalid release version.');
  }
  const manifest = JSON.parse(
    await fetchBoundedText(`${CLAUDE_RELEASES}/${version}/manifest.json`, signal, 1_000_000),
  ) as ClaudeManifest;
  const platform = claudePlatform();
  const asset = manifest.platforms?.[platform];
  if (
    manifest.version !== version
    || !asset
    || !/^[a-f0-9]{64}$/.test(asset.checksum)
    || !Number.isSafeInteger(asset.size)
    || asset.size <= 0
    || asset.size > 1_000_000_000
  ) throw new Error(`Claude Code has no valid release manifest for ${platform}.`);

  const releaseRoot = path.join(managedClaudeReleasesDir(), version, platform);
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude';
  const finalBinary = path.join(releaseRoot, binaryName);
  if (!fs.existsSync(finalBinary)) {
    const staging = `${releaseRoot}.staging.${process.pid}.${Date.now()}`;
    fs.mkdirSync(staging, { recursive: true, mode: 0o700 });
    const stagingBinary = path.join(staging, binaryName);
    try {
      await downloadVerified(
        `${CLAUDE_RELEASES}/${version}/${platform}/${asset.binary}`,
        stagingBinary,
        asset.size,
        asset.checksum,
        signal,
        (progress) => update({ progress, message: `Downloading Claude Code… ${Math.round(progress * 100)}%` }),
      );
      if (process.platform !== 'win32') fs.chmodSync(stagingBinary, 0o755);
      verifyAgentExecutable(stagingBinary, 'Claude Code');
      fs.mkdirSync(path.dirname(releaseRoot), { recursive: true, mode: 0o700 });
      if (!fs.existsSync(releaseRoot)) fs.renameSync(staging, releaseRoot);
      else fs.rmSync(staging, { recursive: true, force: true });
    } catch (error) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw error;
    }
  }
  verifyAgentExecutable(finalBinary, 'Claude Code');
  const relative = path.relative(managedAgentRuntimeRoot('claude'), finalBinary);
  writeManagedClaudeManifest({ version, platform, executable: relative });
  update({ progress: 1, message: 'Claude Code installed.' });
}

const CODEX_INSTALLER = process.platform === 'win32'
  ? 'https://chatgpt.com/codex/install.ps1'
  : 'https://chatgpt.com/codex/install.sh';

async function installCodex(update: (next: ProgressUpdate) => void, signal: AbortSignal): Promise<void> {
  update({ message: 'Downloading the official Codex installer…' });
  const script = await fetchBoundedText(CODEX_INSTALLER, signal, 2_000_000);
  const binDir = managedCodexBinDir();
  fs.mkdirSync(binDir, { recursive: true, mode: 0o700 });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CODEX_INSTALL_DIR: binDir,
    CODEX_HOME: managedCodexInstallerHome(),
    CODEX_NON_INTERACTIVE: 'true',
    PATH: [binDir, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter),
    ELECTRON_RUN_AS_NODE: undefined,
  };
  const command = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-']
    : [];
  await runInstallerScript(command, args, script, env, signal, (line) => {
    const message = line.replace(/^==>\s*/, '').trim();
    if (message) update({ message });
  });
  const executable = path.join(binDir, process.platform === 'win32' ? 'codex.exe' : 'codex');
  verifyAgentExecutable(executable, 'Codex');
  update({ progress: 1, message: 'Codex installed.' });
}

async function fetchBoundedText(url: string, signal: AbortSignal, maxBytes: number): Promise<string> {
  const response = await fetch(url, { signal, redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}) from ${new URL(url).host}.`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) throw new Error(`Download from ${new URL(url).host} exceeded its size limit.`);
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

async function downloadVerified(
  url: string,
  destination: string,
  expectedSize: number,
  expectedSha256: string,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<void> {
  const response = await fetch(url, { signal, redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}) from ${new URL(url).host}.`);
  const handle = await fs.promises.open(destination, 'wx', 0o700);
  const hash = crypto.createHash('sha256');
  let received = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      let offset = 0;
      while (offset < chunk.length) {
        const result = await handle.write(chunk, offset, chunk.length - offset);
        offset += result.bytesWritten;
      }
      hash.update(chunk);
      received += chunk.length;
      if (received > expectedSize) throw new Error('Agent download exceeded the signed manifest size.');
      onProgress(Math.min(0.99, received / expectedSize));
    }
  } finally {
    await handle.close();
  }
  const actual = hash.digest('hex');
  if (received !== expectedSize) throw new Error(`Agent download was incomplete (${received} of ${expectedSize} bytes).`);
  if (actual !== expectedSha256) throw new Error('Agent download failed SHA-256 verification.');
  onProgress(1);
}

function verifyAgentExecutable(executable: string, label: string): void {
  const result = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  });
  if (result.status !== 0) {
    throw new Error(`${label} was downloaded but did not pass its executable check.`);
  }
}

async function runInstallerScript(
  command: string,
  args: string[],
  script: string,
  env: NodeJS.ProcessEnv,
  signal: AbortSignal,
  onLine: (line: string) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    let buffered = '';
    const abort = () => terminateInstallerTree(child);
    signal.addEventListener('abort', abort, { once: true });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffered += chunk;
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? '';
      for (const line of lines) onLine(line);
    });
    child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-4000); });
    child.on('error', (error) => {
      signal.removeEventListener('abort', abort);
      reject(error);
    });
    child.on('close', (code) => {
      signal.removeEventListener('abort', abort);
      if (buffered.trim()) onLine(buffered);
      if (signal.aborted) reject(new Error('Agent installation was cancelled.'));
      else if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Official Agent installer exited with code ${code ?? 'unknown'}.`));
    });
    child.stdin.end(script);
  });
}
