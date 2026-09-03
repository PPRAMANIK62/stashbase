import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_AGENT_ADAPTERS } from '../agent-adapters.ts';
import {
  attachAgentRuntime,
  clearAgentRuntimeFailure,
  discoverAgentRuntimes,
  disposeSessionsBoundToFolder,
  parseAgentEffort,
  registerAgentAdapter,
  reportAgentRuntimeFailure,
  resolveAgentSessionFolder,
  resolveAgentSessionScope,
  resolveSessionBinding,
  runtimeDescriptorFor,
  type AgentClientEvent,
  type AgentServerEvent,
} from '../agent-contract.ts';
import { smokeNativeAgentCli } from '../agent-native-smoke.ts';

const REQUIRED_SHARED_CAPABILITIES = [
  'connection', 'prompts', 'interrupt', 'transcript', 'approvals', 'history',
] as const;

test('every built-in runtime declares the fundamental Shared Agent Contract behavior', () => {
  assert.deepEqual(BUILT_IN_AGENT_ADAPTERS.map((adapter) => [adapter.id, adapter.label]), [
    ['codex', 'Codex'],
    ['claude', 'Claude Code'],
    ['stashbase', 'Wiki Agent'],
  ]);
  for (const adapter of BUILT_IN_AGENT_ADAPTERS) {
    for (const capability of REQUIRED_SHARED_CAPABILITIES) {
      assert.equal(adapter.capabilities[capability], true, `${adapter.id} must support ${capability}`);
    }
    assert.equal(typeof adapter.attach, 'function');
    assert.equal(typeof adapter.stop, 'function');
    assert.equal(typeof adapter.stopFolder, 'function');
    assert.equal(typeof adapter.history.list, 'function');
    assert.equal(typeof adapter.history.messages, 'function');
    assert.equal(typeof adapter.history.rename, 'function');
    assert.equal(typeof adapter.history.remove, 'function');
  }
});

test('runtime-only capabilities stay adapter-specific', () => {
  const capabilities = Object.fromEntries(BUILT_IN_AGENT_ADAPTERS.map((adapter) => [adapter.id, adapter.capabilities]));
  assert.equal(capabilities.claude!.steering, false);
  assert.equal(capabilities.claude!.titleHint, false);
  assert.equal(capabilities.codex!.steering, true);
  assert.equal(capabilities.codex!.titleHint, true);
  assert.equal(capabilities.stashbase!.modes, false);
  assert.equal(capabilities.stashbase!.models, false);
  assert.equal(capabilities.stashbase!.skills, false);
  assert.equal(capabilities.stashbase!.attachments, false);
  assert.equal(capabilities.claude!.attachments, true);
  assert.equal(capabilities.codex!.attachments, true);
});

test('Agent effort identifiers stay runtime-owned while the URL boundary remains bounded', () => {
  assert.equal(parseAgentEffort('ultra'), 'ultra');
  assert.equal(parseAgentEffort('provider_native-level'), 'provider_native-level');
  assert.equal(parseAgentEffort(''), undefined);
  assert.equal(parseAgentEffort(' ultra '), undefined);
  assert.equal(parseAgentEffort('x'.repeat(65)), undefined);
  assert.equal(parseAgentEffort('high\n'), undefined);
});

test('Shared Agent Contract retains lifecycle, streaming, approval, session, and queue event vocabulary', () => {
  const clientEvents: AgentClientEvent[] = [
    { t: 'prompt', text: 'first', titleHint: 'Title' }, { t: 'steer', id: 'queued', text: 'follow-up' },
    { t: 'permission-reply', id: 'approval', allow: true, always: true }, { t: 'interrupt' },
    { t: 'set-model', model: 'native-model' }, { t: 'set-mode', mode: 'plan' },
    { t: 'set-similarity-search', enabled: false }, { t: 'close' },
  ];
  const events: AgentServerEvent[] = [
    { t: 'ready' }, { t: 'session-id', id: 'session' }, { t: 'session-title', title: 'Title' },
    { t: 'models', models: [{ id: 'native-model', label: 'Native model' }], activeModel: 'native-model' },
    { t: 'turn-start' }, { t: 'text', delta: 'text' }, { t: 'thinking', delta: 'thinking' },
    { t: 'tool', id: 'tool', name: 'Read', input: {} }, { t: 'tool-delta', id: 'tool', delta: 'input' },
    { t: 'tool-result', id: 'tool', content: 'done', isError: false },
    { t: 'file-diff', id: 'diff', file: 'notes.md', before: 'old', after: 'new', additions: 1, deletions: 1 },
    { t: 'permission', id: 'approval', toolUseId: 'tool', name: 'Write', title: null, input: {} },
    { t: 'steer-result', id: 'queued', ok: true },
    // create_project rebinding a library-scoped chat to the new project.
    { t: 'scope-changed', scope: { kind: 'folder', path: '/Users/me/Documents/StashBase/Project' } },
    { t: 'turn-end', isError: false },
    { t: 'error', message: 'runtime unavailable' }, { t: 'exit' },
    { t: 'exit', message: 'runtime stopped unexpectedly' },
    { t: 'exit', reason: 'scope-removed', folder: '/Users/me/Projects/Research' },
  ];
  assert.equal(clientEvents.length, 8);
  assert.equal(events.length, 19);
});

test('capability discovery reports supported, unavailable, and failed runtimes without changing adapter metadata', () => {
  const expectedInstallHints = {
    claude: process.platform === 'win32'
      ? 'irm https://claude.ai/install.ps1 | iex'
      : 'curl -fsSL https://claude.ai/install.sh | bash',
    codex: process.platform === 'win32'
      ? 'irm https://chatgpt.com/codex/install.ps1 | iex'
      : 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
  } as const;
  for (const adapter of BUILT_IN_AGENT_ADAPTERS) {
    if (adapter.id === 'stashbase') continue;
    const available = runtimeDescriptorFor(adapter, `/native/${adapter.id}`);
    assert.equal(available.state, 'available');
    assert.equal(available.source, 'system');
    assert.equal(available.bootstrap.phase, 'idle');
    const unavailable = runtimeDescriptorFor(adapter, null);
    assert.equal(unavailable.state, 'unavailable');
    assert.equal(unavailable.source, null);
    assert.equal(unavailable.installHint, expectedInstallHints[adapter.id]);
  }
  const adapter = BUILT_IN_AGENT_ADAPTERS.find((candidate) => candidate.id === 'claude')!;

  reportAgentRuntimeFailure(adapter.id, new Error('native protocol changed'));
  const failed = runtimeDescriptorFor(adapter, '/native/claude');
  assert.equal(failed.state, 'failed');
  assert.equal(failed.error, 'native protocol changed');
  assert.deepEqual(failed.capabilities, adapter.capabilities);
  clearAgentRuntimeFailure(adapter.id);
});

test('capability discovery publishes the registered adapter catalog', () => {
  for (const adapter of BUILT_IN_AGENT_ADAPTERS) registerAgentAdapter(adapter);
  const discovered = discoverAgentRuntimes();
  assert.deepEqual(discovered.map((runtime) => runtime.id), ['codex', 'claude', 'stashbase']);
  for (const runtime of discovered) {
    const adapter = BUILT_IN_AGENT_ADAPTERS.find((candidate) => candidate.id === runtime.id)!;
    assert.equal(runtime.endpoint, '/ws/agent');
    assert.deepEqual(runtime.capabilities, adapter.capabilities);
  }
});

test('an explicit session folder is accepted only when it is a registered library folder', () => {
  const members = ['/Users/me/Documents/StashBase/Notes', '/Users/me/Projects/Research'];

  // Explicit member folder → accepted with the stored member spelling.
  const accepted = resolveAgentSessionFolder('/Users/me/Projects/Research', members);
  assert.deepEqual(accepted, { ok: true, folder: '/Users/me/Projects/Research' });

  // Absent/empty → fall back to the window's current folder (no explicit binding).
  assert.deepEqual(resolveAgentSessionFolder(undefined, members), { ok: true });
  assert.deepEqual(resolveAgentSessionFolder(null, members), { ok: true });
  assert.deepEqual(resolveAgentSessionFolder('   ', members), { ok: true });

  // Anything outside membership is rejected — never bound to an agent session.
  assert.equal(resolveAgentSessionFolder('/etc', members).ok, false);
  assert.equal(resolveAgentSessionFolder('/Users/me/Projects/Research/nested', members).ok, false);
  assert.equal(resolveAgentSessionFolder('relative/path', members).ok, false);
  assert.equal(resolveAgentSessionFolder(['/Users/me/Projects/Research'], members).ok, false);
  assert.equal(resolveAgentSessionFolder('/anything', []).ok, false);
});

test('an explicit session scope is scope=library, a member folder, or nothing', () => {
  const members = ['/Users/me/Documents/StashBase/Notes', '/Users/me/Projects/Research'];

  // scope=library → accepted as the library-wide scope.
  assert.deepEqual(resolveAgentSessionScope('library', undefined, members), { ok: true, scope: { kind: 'library' } });
  // Explicit member folder → folder scope with the stored member spelling.
  assert.deepEqual(
    resolveAgentSessionScope(undefined, '/Users/me/Projects/Research', members),
    { ok: true, scope: { kind: 'folder', path: '/Users/me/Projects/Research' } },
  );
  // Both absent/empty → no explicit scope: the window's current folder
  // applies when one exists, else the library fallback.
  assert.deepEqual(resolveAgentSessionScope(undefined, undefined, members), { ok: true });
  assert.deepEqual(resolveAgentSessionScope('', '  ', members), { ok: true });

  // Invalid folders are still rejected exactly as before.
  assert.equal(resolveAgentSessionScope(undefined, '/etc', members).ok, false);
  assert.equal(resolveAgentSessionScope(undefined, 'relative/path', members).ok, false);
  // Unknown scope values and contradictory scope+folder are rejected.
  assert.equal(resolveAgentSessionScope('global', undefined, members).ok, false);
  assert.equal(resolveAgentSessionScope(['library'], undefined, members).ok, false);
  assert.equal(resolveAgentSessionScope('library', '/Users/me/Projects/Research', members).ok, false);
});

test('session binding: library scope binds the folder home and is not folder-bound', () => {
  const home = '/Users/me/Documents/StashBase';

  // Explicit library scope → cwd is the reserved library cwd (the folder
  // home) even while the window has a current folder.
  assert.deepEqual(
    resolveSessionBinding({ scope: 'library', currentFolder: '/Users/me/Projects/Research', folderHome: home }),
    { cwd: home, libraryScoped: true },
  );
  // Explicit folder → that member root.
  assert.deepEqual(
    resolveSessionBinding({ folder: '/tmp/scratch', currentFolder: '/Users/me/Projects/Research', folderHome: home }),
    { cwd: '/tmp/scratch', libraryScoped: false },
  );
  // Absent scope → the window's current folder when one exists…
  assert.deepEqual(
    resolveSessionBinding({ currentFolder: '/Users/me/Projects/Research', folderHome: home }),
    { cwd: '/Users/me/Projects/Research', libraryScoped: false },
  );
  // …else the library fallback (no more "No folder open." dead end).
  assert.deepEqual(
    resolveSessionBinding({ currentFolder: null, folderHome: home }),
    { cwd: home, libraryScoped: true },
  );
});

test('folder removal never tears down library-scoped sessions', () => {
  const librarySession = {
    disposed: false,
    // A library-scoped session reports no bound folder even though its
    // cwd is the folder home.
    boundFolder: (): string | null => null,
    dispose() { librarySession.disposed = true; },
  };
  const folderSession = {
    disposed: false,
    boundFolder: () => '/Users/me/Projects/Research',
    dispose() { folderSession.disposed = true; },
  };
  const sessions = new Set([librarySession, folderSession]);

  disposeSessionsBoundToFolder(sessions, '/Users/me/Projects/Research');
  assert.equal(folderSession.disposed, true);
  assert.equal(librarySession.disposed, false);

  // Even removing a member folder that happens to equal the folder home
  // cannot match a library session: its boundFolder() is null.
  disposeSessionsBoundToFolder(sessions, '/Users/me/Documents/StashBase');
  assert.equal(librarySession.disposed, false);
  assert.deepEqual([...sessions], [librarySession]);
});

test('folder-bound teardown ends only the sessions bound to the removed folder', () => {
  const makeSession = (bound: string | null) => {
    const session = {
      disposed: false,
      termination: null as null | { kind: 'scope-removed'; folder: string },
      boundFolder: () => bound,
      dispose(termination?: { kind: 'scope-removed'; folder: string }) {
        session.disposed = true;
        session.termination = termination ?? null;
      },
    };
    return session;
  };
  const removedA = makeSession('/Users/me/Projects/Research');
  // Equivalent spelling still matches — comparison is filesystem identity.
  const removedB = makeSession('/Users/me/Projects/Research/');
  const otherFolder = makeSession('/Users/me/Documents/StashBase/Notes');
  const unstarted = makeSession(null);
  const sessions = new Set([removedA, removedB, otherFolder, unstarted]);

  disposeSessionsBoundToFolder(sessions, '/Users/me/Projects/Research');

  assert.equal(removedA.disposed, true);
  assert.equal(removedB.disposed, true);
  assert.deepEqual(removedA.termination, {
    kind: 'scope-removed',
    folder: '/Users/me/Projects/Research',
  });
  assert.deepEqual(removedB.termination, removedA.termination);
  assert.equal(otherFolder.disposed, false);
  assert.equal(otherFolder.termination, null);
  assert.equal(unstarted.disposed, false);
  assert.deepEqual([...sessions], [otherFolder, unstarted]);
});

test('unsupported runtime connections return a contract error and close cleanly', () => {
  const sent: string[] = [];
  let closed = false;
  const ws = { send: (message: string) => sent.push(message), close: () => { closed = true; } };
  attachAgentRuntime('unsupported', ws as never, { windowId: 'test-window' });
  assert.deepEqual(sent, [JSON.stringify({ t: 'error', message: 'Unsupported agent runtime.' })]);
  assert.equal(closed, true);
});

test('native CLI smoke checks report protocol incompatibility with an actionable error', () => {
  const codex = smokeNativeAgentCli('codex', '/native/codex', () => ({ status: 0, stdout: 'usage: codex', stderr: '' }));
  assert.equal(codex.ok, false);
  assert.match(codex.message, /app-server/);

  const claude = smokeNativeAgentCli('claude', '/native/claude', () => ({ status: 1, stdout: '', stderr: 'bad flag' }));
  assert.equal(claude.ok, false);
  assert.match(claude.message, /exit code 1/);
});
