/**
 * Compatibility-first contract for the Agent Panel.
 *
 * Runtime-specific bridges register a small adapter here.  The renderer and
 * route layer speak only in terms of this contract, while Claude's SDK and
 * Codex's app-server remain free to keep their native lifecycle details.
 */
import type { WebSocket } from 'ws';
import { CLIS, launchCommandFor } from './terminal.ts';
import { resolveAgentCli } from './agent-cli.ts';
import { agentExecutableSource } from './agent-runtime-paths.ts';
import { agentBootstrapStatus } from './agent-runtime-installer.ts';
import { ensureAgentMcp } from './agent-mcp.ts';
import { rememberedCatalogFor } from './agent-model-catalog.ts';
import { filesystemPath } from './filesystem-path.ts';
import type { AgentModelCatalog } from '../shared/agent-runtime.ts';

/** The renderer↔server wire vocabulary lives in `shared/agent-protocol.ts` so
 * the renderer can import it without pulling this module's server-only graph
 * (`ws`, the CLI resolvers, the runtime installer) into the browser bundle.
 * Re-exported here so server-side callers keep one import site for the whole
 * contract. */
export type {
  AgentClientEvent,
  AgentId,
  AgentModel,
  AgentServerEvent,
  AgentSkill,
} from '../shared/agent-protocol.ts';
import type { AgentId } from '../shared/agent-protocol.ts';

export type AgentRuntimeState = 'available' | 'unavailable' | 'failed';
import { AGENT_ACCESS_MODES, type AgentAccessMode } from '../shared/agent-runtime.ts';

export { AGENT_ACCESS_MODES, type AgentAccessMode };

export function isAgentAccessMode(value: unknown): value is AgentAccessMode {
  return typeof value === 'string' && (AGENT_ACCESS_MODES as readonly string[]).includes(value);
}

/** Effort identifiers are runtime-owned opaque strings. Keep the URL boundary
 * bounded and free of control characters without narrowing future runtimes to
 * a StashBase-maintained enum. */
export function parseAgentEffort(value: unknown): string | undefined {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 64
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : undefined;
}

export interface AgentCapabilities {
  connection: true;
  prompts: true;
  interrupt: true;
  transcript: true;
  approvals: true;
  history: true;
  attachments: boolean;
  /** The permission promises this runtime can honor; empty hides the control. */
  modes: readonly AgentAccessMode[];
  effort: boolean;
  /** The runtime can enumerate native models and accept an explicit choice;
   * the adapter owns whether that choice begins a session or a later turn. */
  models: boolean;
  skills: boolean;
  steering: boolean;
  titleHint: boolean;
}

export interface AgentConnectionOptions {
  windowId: string;
  effort?: string;
  resume?: string;
  access?: AgentAccessMode;
  /** Undefined deliberately means "use the runtime's configured default". */
  model?: string;
  /** Explicit session folder (a registered project-member root). Mutually
   * exclusive with `scope`. Undefined with no `scope` means "use the
   * window's current folder when one exists, else the project". Callers
   * must have validated with `resolveAgentSessionScope`. */
  folder?: string;
  /** Explicit unbound session scope. The session binds the folder
   * home as its cwd and is NOT bound to any member folder. */
  scope?: 'unbound';
}

export type AgentSessionFolderResolution =
  | { ok: true; folder?: string }
  | { ok: false; message: string };

/** Resolve an optional explicit session folder against project membership.
 * Absent/empty → follow the window's current folder (folder stays undefined).
 * Present → it must match a registered member root; the stored member
 * spelling is returned so downstream path-keyed state stays consistent.
 * Anything else is rejected — an agent session must never be bound to an
 * arbitrary filesystem path. */
export function resolveAgentSessionFolder(
  requested: unknown,
  memberRoots: readonly string[],
): AgentSessionFolderResolution {
  if (requested == null) return { ok: true };
  if (typeof requested !== 'string') return { ok: false, message: 'folder must be a project folder path' };
  const trimmed = requested.trim();
  if (!trimmed) return { ok: true };
  if (!filesystemPath.isAbsolute(trimmed)) return { ok: false, message: 'folder must be an absolute project folder path' };
  for (const root of memberRoots) {
    try {
      if (filesystemPath.equal(root, trimmed)) return { ok: true, folder: root };
    } catch {
      // A malformed candidate cannot equal a member root; keep checking.
    }
  }
  return { ok: false, message: 'folder is not a registered project folder' };
}

/** Explicit session scope: one project folder, or an unbound conversation. */
export type AgentSessionScope = { kind: 'unbound' } | { kind: 'folder'; path: string };

export type AgentSessionScopeResolution =
  | { ok: true; scope?: AgentSessionScope }
  | { ok: false; message: string };

/** Resolve the optional explicit scope of a connect / history request.
 * `scope=unbound` is the only recognized scope value; an explicit folder
 * stays membership-validated through `resolveAgentSessionFolder`; sending
 * both is contradictory and rejected. Both absent → no explicit scope:
 * the caller falls back to the window's current folder when one exists,
 * else an unbound conversation. */
export function resolveAgentSessionScope(
  requestedScope: unknown,
  requestedFolder: unknown,
  memberRoots: readonly string[],
): AgentSessionScopeResolution {
  const rawScope = typeof requestedScope === 'string' ? requestedScope.trim() : requestedScope == null ? '' : null;
  if (rawScope == null) return { ok: false, message: 'scope must be "unbound"' };
  const rawFolder = typeof requestedFolder === 'string' ? requestedFolder.trim() : requestedFolder == null ? '' : requestedFolder;
  if (rawScope) {
    if (rawScope !== 'unbound') return { ok: false, message: 'scope must be "unbound"' };
    if (rawFolder) return { ok: false, message: 'scope=unbound cannot be combined with a folder' };
    return { ok: true, scope: { kind: 'unbound' } };
  }
  const folder = resolveAgentSessionFolder(requestedFolder, memberRoots);
  if (!folder.ok) return folder;
  return folder.folder ? { ok: true, scope: { kind: 'folder', path: folder.folder } } : { ok: true };
}

/** Resolve the cwd and unbound flag a session binds at start time.
 * Explicit unbound scope → the folder home (the historical unbound cwd —
 * unbound history persists under it, not under any member folder).
 * Explicit folder → that member root. Neither → the window's current
 * folder when one exists, else the unbound fallback. `unbound`
 * sessions report no bound folder, so member-folder removal never tears
 * them down. */
export function resolveSessionBinding(options: {
  scope?: 'unbound';
  folder?: string;
  currentFolder: string | null;
  folderHome: string;
}): { cwd: string; unbound: boolean } {
  if (options.scope === 'unbound') return { cwd: options.folderHome, unbound: true };
  if (options.folder) return { cwd: options.folder, unbound: false };
  if (options.currentFolder) return { cwd: options.currentFolder, unbound: false };
  return { cwd: options.folderHome, unbound: true };
}

export interface AgentHistoryActions {
  list(folder: string | null): Promise<unknown[]>;
  messages(id: string, folder: string | null): Promise<unknown[]>;
  /** Protocol-v2 replay metadata. Optional keeps third-party/older adapters
   * compatible with the established messages-only history contract. */
  replay?(id: string, folder: string | null): Promise<unknown>;
  rename(id: string, title: string, folder: string | null): Promise<unknown>;
  remove(id: string, folder: string | null): Promise<void>;
}

export interface AgentAdapter {
  id: AgentId;
  label: string;
  vendor: string;
  /** Bundled adapters own their executable, account gate, and local service
   * readiness. External CLI adapters retain the shared discovery/bootstrap
   * path below. */
  runtime?: () => Omit<AgentRuntimeDescriptor, 'id' | 'label' | 'vendor' | 'endpoint' | 'capabilities'>;
  capabilities: AgentCapabilities;
  attach(ws: WebSocket, options: AgentConnectionOptions): void;
  stop(windowId?: string): void;
  /** End every live session bound to this member folder, across all windows.
   * Project removal uses this — a removed folder must not keep
   * running sessions, even in windows currently showing another folder. */
  stopFolder(folderAbs: string): void;
  history: AgentHistoryActions;
}

/** The registry entry shape both runtime session sets satisfy. */
export type AgentSessionTermination = {
  kind: 'scope-removed';
  folder: string;
};

export interface FolderBoundAgentSession {
  boundFolder(): string | null;
  dispose(termination?: AgentSessionTermination): void;
}

/** Dispose exactly the sessions bound to `folderAbs` (filesystem identity
 * comparison), leaving sessions bound to other folders running. Shared by the
 * runtime registries so folder removal has one teardown semantic. */
export function disposeSessionsBoundToFolder<T extends FolderBoundAgentSession>(
  sessions: Set<T>,
  folderAbs: string,
): void {
  for (const session of [...sessions]) {
    const bound = session.boundFolder();
    let matches = false;
    try {
      matches = bound != null && filesystemPath.equal(bound, folderAbs);
    } catch {
      matches = false;
    }
    if (matches) {
      session.dispose({ kind: 'scope-removed', folder: folderAbs });
      sessions.delete(session);
    }
  }
}

export interface AgentRuntimeDescriptor {
  id: AgentId;
  label: string;
  vendor: string;
  installHint: string;
  launchCommand: string;
  endpoint: '/ws/agent';
  installed: boolean;
  source: 'bundled' | 'system' | 'managed' | null;
  state: AgentRuntimeState;
  bootstrap: ReturnType<typeof agentBootstrapStatus>;
  error?: string;
  capabilities: AgentCapabilities;
  /** The runtime's remembered model catalog, once one has been read. */
  catalog?: AgentModelCatalog;
}

const adapters = new Map<AgentId, AgentAdapter>();
const runtimeFailures = new Map<AgentId, string>();

export function agentExecutableFor(id: Exclude<AgentId, 'stashbase'>): string | null {
  const config = id === 'claude'
    ? { name: 'claude', envNames: ['STASHBASE_CLAUDE_BIN', 'CLAUDE_CODE_BIN'], logLabel: 'Claude Code' }
    : { name: 'codex', envNames: ['STASHBASE_CODEX_BIN', 'CODEX_CLI_BIN', 'CODEX_CLI_PATH'], logLabel: 'Codex' };
  return resolveAgentCli(config, () => {});
}

export function registerAgentAdapter(adapter: AgentAdapter): void {
  adapters.set(adapter.id, adapter);
}

/** Pure descriptor builder used by discovery and its contract tests. */
export function runtimeDescriptorFor(
  adapter: AgentAdapter,
  executable = adapter.id === 'stashbase' ? null : agentExecutableFor(adapter.id),
): AgentRuntimeDescriptor {
  if (adapter.runtime) {
    return {
      id: adapter.id,
      label: adapter.label,
      vendor: adapter.vendor,
      endpoint: '/ws/agent',
      capabilities: adapter.capabilities,
      ...adapter.runtime(),
    };
  }
  if (adapter.id === 'stashbase') throw new Error('Bundled Agent adapter must describe its runtime.');
  const cli = CLIS[adapter.id];
  const installed = executable !== null;
  const failure = runtimeFailures.get(adapter.id);
  const state: AgentRuntimeState = !installed ? 'unavailable' : failure ? 'failed' : 'available';
  return {
    id: adapter.id,
    label: adapter.label,
    vendor: adapter.vendor,
    installHint: cli.installHint,
    launchCommand: launchCommandFor(cli),
    endpoint: '/ws/agent',
    installed,
    source: agentExecutableSource(adapter.id, executable),
    state,
    bootstrap: agentBootstrapStatus(adapter.id),
    ...(failure ? { error: failure } : {}),
    capabilities: adapter.capabilities,
  };
}

export function agentAdapter(id: string): AgentAdapter | null {
  return id === 'stashbase' || id === 'claude' || id === 'codex' ? adapters.get(id) ?? null : null;
}

/** Native discovery is performed at request time so a CLI installed or
 * upgraded while StashBase is open is reflected without a bundled-version
 * assumption. */
export function discoverAgentRuntimes(): AgentRuntimeDescriptor[] {
  return [...adapters.values()].map((adapter) => {
    const descriptor = runtimeDescriptorFor(adapter);
    const catalog = rememberedCatalogFor(descriptor);
    return catalog ? { ...descriptor, catalog } : descriptor;
  });
}

export function attachAgentRuntime(id: string, ws: WebSocket, options: AgentConnectionOptions): void {
  const adapter = agentAdapter(id);
  if (!adapter) {
    ws.send(JSON.stringify({ t: 'error', message: 'Unsupported agent runtime.' }));
    ws.close();
    return;
  }
  const runtime = runtimeDescriptorFor(adapter);
  if (!runtime.installed || runtime.state !== 'available') {
    const message = runtime.error ?? `${adapter.label} is not ready.`;
    ws.send(JSON.stringify({ t: 'error', message }));
    ws.close();
    return;
  }
  if (adapter.id !== 'stashbase' && !agentExecutableFor(adapter.id)) {
    ws.send(JSON.stringify({ t: 'error', message: `${adapter.label} CLI is not available.` }));
    ws.close();
    return;
  }
  try {
    if (adapter.id !== 'stashbase') ensureAgentMcp(adapter.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ws.send(JSON.stringify({ t: 'error', message: `Could not connect StashBase MCP: ${message}` }));
    ws.close();
    return;
  }
  clearAgentRuntimeFailure(adapter.id);
  adapter.attach(ws, options);
}

export function stopAgentRuntime(id: AgentId, windowId?: string): void {
  agentAdapter(id)?.stop(windowId);
}

/** Retire every adapter's sessions before releasing any window binding. */
export function stopAgentRuntimesForFolder(folderAbs: string): void {
  for (const adapter of adapters.values()) adapter.stopFolder(folderAbs);
}

export function reportAgentRuntimeFailure(id: AgentId, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  runtimeFailures.set(id, message.slice(0, 500));
}

export function clearAgentRuntimeFailure(id: AgentId): void {
  runtimeFailures.delete(id);
}
