/**
 * create_project semantics: name/location validation, directory creation +
 * library registration, the rebind decision (library-scoped calling chats
 * only), and the persisted session→folder history override the history
 * routes consult.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// The override store persists under the app-data root; isolate it before
// importing the modules under test (each test file runs in its own process).
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-agent-projects-'));
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(scratch, 'app-data');

const { createProjectFolder, resolveCreateProjectTarget } = await import('../agent-projects.ts');
type CreateProjectDeps = import('../agent-projects.ts').CreateProjectDeps;
const {
  createProjectRebindPlan,
  registerAttributedAgentSession,
  unregisterAttributedAgentSession,
  attributedAgentSession,
} = await import('../agent-session-registry.ts');
type AttributedAgentSession = import('../agent-session-registry.ts').AttributedAgentSession;
const {
  agentSessionFolderOverride,
  agentSessionFolderOverrides,
  clearAgentSessionFolderOverride,
  historyRowInFolder,
  historyRowsForFolder,
  missingOverriddenSessionIds,
  setAgentSessionFolderOverride,
} = await import('../agent-session-folders.ts');

const HOME = path.join(scratch, 'folder-home');
const MEMBER = path.join(scratch, 'members', 'Research');
fs.mkdirSync(HOME, { recursive: true });
fs.mkdirSync(MEMBER, { recursive: true });

interface DepsLog {
  registered: string[];
  agentsFiles: string[];
  treeChanges: number;
  synced: string[];
  events: string[];
  overrides: Array<{ agent: string; id: string; folder: string }>;
  cleared: Array<{ agent: string; id: string }>;
}

function fakeSession(options: {
  bound?: string | null;
  library?: boolean;
  nativeId?: string | null;
  rebindResult?: boolean;
  events?: string[];
}): AttributedAgentSession & { reboundTo: string | null } {
  const session = {
    agentId: 'claude' as const,
    reboundTo: null as string | null,
    boundFolder: () => options.bound ?? null,
    isLibraryScoped: () => options.library ?? false,
    nativeSessionId: () => options.nativeId ?? null,
    rebindToFolder(folderAbs: string) {
      options.events?.push('rebind');
      if (options.rebindResult === false) return false;
      session.reboundTo = folderAbs;
      return true;
    },
  };
  return session;
}

function fakeDeps(session: AttributedAgentSession | null): { deps: CreateProjectDeps; log: DepsLog } {
  const log: DepsLog = { registered: [], agentsFiles: [], treeChanges: 0, synced: [], events: [], overrides: [], cleared: [] };
  const deps: CreateProjectDeps = {
    folderHome: () => HOME,
    memberRoots: () => [MEMBER],
    register: (abs) => log.registered.push(abs),
    ensureAgentsFile: (abs) => { log.agentsFiles.push(abs); return true; },
    noteTreeChanged: () => { log.treeChanges += 1; },
    syncFolder: async (abs) => { log.synced.push(abs); },
    session: () => session,
    setOverride: (agent, id, folder) => { log.events.push('override'); log.overrides.push({ agent, id, folder }); },
    clearOverride: (agent, id) => { log.cleared.push({ agent, id }); },
  };
  return { deps, log };
}

test('create_project validates the name as one cross-platform-safe segment', () => {
  const scope = { folderHome: HOME, memberRoots: [MEMBER] };
  assert.equal(resolveCreateProjectTarget('Thesis Notes', undefined, scope).ok, true);
  for (const bad of ['', '   ', 'a/b', 'a\\b', '..', '.hidden', 'name.', 'na<me', 'x'.repeat(65)]) {
    assert.equal(resolveCreateProjectTarget(bad, undefined, scope).ok, false, `name ${JSON.stringify(bad)} must be rejected`);
  }
  assert.equal(resolveCreateProjectTarget(42, undefined, scope).ok, false);
});

test('create_project defaults to the folder home and accepts only owned locations', () => {
  const scope = { folderHome: HOME, memberRoots: [MEMBER] };
  const defaulted = resolveCreateProjectTarget('Proj', undefined, scope);
  assert.deepEqual(defaulted, { ok: true, parent: HOME, target: path.join(HOME, 'Proj'), name: 'Proj' });

  // The folder home itself, inside it, a member root, and inside a member
  // root are all valid explicit locations.
  for (const location of [HOME, path.join(HOME, 'nested'), MEMBER, path.join(MEMBER, 'sub')]) {
    const resolved = resolveCreateProjectTarget('Proj', location, scope);
    assert.equal(resolved.ok, true, `location ${location} must be accepted`);
    if (resolved.ok) assert.equal(resolved.target, path.join(location, 'Proj'));
  }

  // Arbitrary host paths and relative paths never become registered folders.
  for (const location of ['/etc', os.homedir(), 'relative/dir', path.dirname(HOME)]) {
    assert.equal(resolveCreateProjectTarget('Proj', location, scope).ok, false, `location ${location} must be rejected`);
  }
});

test('create_project creates, seeds AGENTS.md, registers, and reports no rebind without attribution', async () => {
  const { deps, log } = fakeDeps(null);
  const result = await createProjectFolder({ name: 'Unattributed' }, deps);
  const target = path.join(HOME, 'Unattributed');
  assert.equal(result.path, target);
  assert.equal(result.registered, true);
  assert.equal(result.rebound, false);
  assert.equal(fs.statSync(target).isDirectory(), true);
  assert.deepEqual(log.registered, [target]);
  assert.deepEqual(log.agentsFiles, [target]);
  assert.equal(log.treeChanges, 1);
  assert.deepEqual(log.overrides, []);
  // Background bind/sync is queued for the new member.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(log.synced, [target]);
});

test('a library-scoped calling chat is rebound, with the history override persisted first', async () => {
  const events: string[] = [];
  const session = fakeSession({ library: true, nativeId: 'native-session-1', events });
  const { deps, log } = fakeDeps(session);
  log.events = events;
  const result = await createProjectFolder({ name: 'Rebound', agentSessionId: 'attr-1' }, deps);
  assert.equal(result.rebound, true);
  assert.equal(session.reboundTo, path.join(HOME, 'Rebound'));
  assert.deepEqual(log.overrides, [{ agent: 'claude', id: 'native-session-1', folder: path.join(HOME, 'Rebound') }]);
  // Override before rebind: the renderer reacts to scope-changed by loading
  // the project's history, which must already contain this session.
  assert.deepEqual(events, ['override', 'rebind']);
  assert.deepEqual(log.cleared, []);
});

test('a folder-bound calling chat is NEVER rebound — create + register only', async () => {
  const session = fakeSession({ bound: MEMBER, nativeId: 'native-session-2' });
  const { deps, log } = fakeDeps(session);
  const result = await createProjectFolder({ name: 'KeepBound' }, deps);
  assert.equal(result.rebound, false);
  assert.match(result.note, /stays bound/);
  assert.match(result.note, /Research/);
  assert.equal(session.reboundTo, null);
  assert.deepEqual(log.overrides, []);
  assert.deepEqual(log.registered, [path.join(HOME, 'KeepBound')]);
});

test('a rebind race with session teardown rolls the override back', async () => {
  const session = fakeSession({ library: true, nativeId: 'native-session-3', rebindResult: false });
  const { deps, log } = fakeDeps(session);
  const result = await createProjectFolder({ name: 'RacedClose' }, deps);
  assert.equal(result.rebound, false);
  assert.equal(log.overrides.length, 1);
  assert.deepEqual(log.cleared, [{ agent: 'claude', id: 'native-session-3' }]);
});

test('an existing directory is a conflict, not a silent reuse', async () => {
  const { deps } = fakeDeps(null);
  await createProjectFolder({ name: 'Duplicate' }, deps);
  await assert.rejects(
    () => createProjectFolder({ name: 'Duplicate' }, deps),
    (err: Error & { status?: number; code?: string }) => err.status === 409 && err.code === 'FOLDER_EXISTS',
  );
});

test('invalid input surfaces a 400 without touching disk', async () => {
  const { deps, log } = fakeDeps(null);
  await assert.rejects(
    () => createProjectFolder({ name: 'nested/name' }, deps),
    (err: Error & { status?: number }) => err.status === 400,
  );
  await assert.rejects(
    () => createProjectFolder({ name: 'Fine', location: '/etc' }, deps),
    (err: Error & { status?: number }) => err.status === 400,
  );
  await assert.rejects(
    () => createProjectFolder({ name: 'Fine', location: path.join(HOME, 'does-not-exist') }, deps),
    (err: Error & { status?: number }) => err.status === 400,
  );
  assert.deepEqual(log.registered, []);
});

test('rebind plan: only live library-scoped sessions migrate', () => {
  assert.deepEqual(createProjectRebindPlan(null), { kind: 'none', reason: 'no-session' });
  assert.deepEqual(
    createProjectRebindPlan({ boundFolder: () => MEMBER, isLibraryScoped: () => false }),
    { kind: 'none', reason: 'folder-bound', folder: MEMBER },
  );
  assert.deepEqual(
    createProjectRebindPlan({ boundFolder: () => null, isLibraryScoped: () => true }),
    { kind: 'rebind' },
  );
  // A session that is neither bound nor library-scoped (already torn down /
  // rebound) is treated like no session.
  assert.deepEqual(
    createProjectRebindPlan({ boundFolder: () => null, isLibraryScoped: () => false }),
    { kind: 'none', reason: 'no-session' },
  );
});

test('the attribution registry maps ids to live sessions and forgets them on unregister', () => {
  const session = fakeSession({ library: true });
  registerAttributedAgentSession('attr-registry', session);
  assert.equal(attributedAgentSession('attr-registry'), session);
  assert.equal(attributedAgentSession('  attr-registry  '), session);
  assert.equal(attributedAgentSession('unknown'), null);
  assert.equal(attributedAgentSession(undefined), null);
  unregisterAttributedAgentSession('attr-registry');
  assert.equal(attributedAgentSession('attr-registry'), null);
});

test('session→folder overrides persist, read back, and clear', () => {
  const project = path.join(HOME, 'OverrideProj');
  setAgentSessionFolderOverride('claude', 'sess-a', project);
  setAgentSessionFolderOverride('codex', 'thread-b', project);
  assert.equal(agentSessionFolderOverride('claude', 'sess-a'), project);
  assert.equal(agentSessionFolderOverride('codex', 'thread-b'), project);
  assert.equal(agentSessionFolderOverride('claude', 'thread-b'), null);
  assert.deepEqual(agentSessionFolderOverrides('codex'), { 'thread-b': project });

  clearAgentSessionFolderOverride('claude', 'sess-a');
  assert.equal(agentSessionFolderOverride('claude', 'sess-a'), null);
  assert.equal(agentSessionFolderOverride('codex', 'thread-b'), project);
  clearAgentSessionFolderOverride('codex', 'thread-b');

  // A malformed persisted file fails soft to no overrides.
  const file = path.join(process.env.STASHBASE_LOCAL_DATA_ROOT!, 'agent-session-folders.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'not json', 'utf8');
  assert.equal(agentSessionFolderOverride('claude', 'sess-a'), null);
  fs.rmSync(file);
});

test('history listings: overridden sessions leave the library and join their project', () => {
  const library = HOME; // the reserved library cwd
  const project = path.join(HOME, 'HistoryProj');
  const overrides = { 'moved-1': project };
  const libraryRows = [{ id: 'moved-1' }, { id: 'stays-1' }];

  // The library listing (folder-home cwd) excludes the overridden session…
  assert.deepEqual(historyRowsForFolder(libraryRows, overrides, library), [{ id: 'stays-1' }]);
  // …the project listing keeps native project rows and reports the moved
  // session as missing (it natively lives under the library cwd).
  assert.deepEqual(historyRowsForFolder([{ id: 'native-proj' }], overrides, project), [{ id: 'native-proj' }]);
  assert.deepEqual(missingOverriddenSessionIds([{ id: 'native-proj' }], overrides, project), ['moved-1']);
  // Once the row is present (merged from the library cwd), nothing is missing.
  assert.deepEqual(missingOverriddenSessionIds([{ id: 'moved-1' }], overrides, project), []);

  // Row-level membership: an override wins over the native cwd match.
  assert.equal(historyRowInFolder(project, true, library), false);
  assert.equal(historyRowInFolder(project, false, project), true);
  assert.equal(historyRowInFolder(null, true, library), true);
  assert.equal(historyRowInFolder(undefined, false, library), false);
});
