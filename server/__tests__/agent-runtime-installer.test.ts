import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveAgentCli, resolveAgentCliWithLoginShell } from '../agent-cli.ts';
import {
  AgentBootstrapCoordinator,
  claudePlatform,
  type AgentBootstrapDependencies,
} from '../agent-runtime-installer.ts';
import {
  initialAgentDiscoveryPolicy,
  managedCodexBinDir,
  setAgentRuntimeDebugState,
} from '../agent-runtime-paths.ts';

function fakeDependencies(overrides: Partial<AgentBootstrapDependencies> = {}) {
  let installed = false;
  let configured = 0;
  const dependencies: AgentBootstrapDependencies = {
    resolveExecutable: () => installed ? '/managed/codex' : null,
    installRuntime: async (_id, update) => {
      update({ progress: 0.5, message: 'Downloading… 50%' });
      await Promise.resolve();
      installed = true;
    },
    configureMcp: () => { configured += 1; },
    debugState: () => ({
      enabled: true,
      discoveryPolicy: 'managed-only',
      simulateInstallFailure: false,
      simulateMcpFailure: false,
    }),
    ...overrides,
  };
  return { dependencies, configured: () => configured };
}

test('missing runtime moves through install and MCP configuration to ready', async () => {
  const fake = fakeDependencies();
  const coordinator = new AgentBootstrapCoordinator(fake.dependencies);

  assert.equal(coordinator.begin('codex').phase, 'installing');
  const settled = await coordinator.wait('codex');

  assert.equal(settled.phase, 'ready');
  assert.equal(settled.progress, 1);
  assert.equal(fake.configured(), 1);
});

test('existing runtime skips download but still ensures MCP configuration', () => {
  let installs = 0;
  let configured = 0;
  const fake = fakeDependencies({
    resolveExecutable: () => '/system/claude',
    installRuntime: async () => { installs += 1; },
    configureMcp: () => { configured += 1; },
  });
  const coordinator = new AgentBootstrapCoordinator(fake.dependencies);

  assert.equal(coordinator.begin('claude').phase, 'ready');
  assert.equal(installs, 0);
  assert.equal(configured, 1);
});

test('startup connects MCP for discovered runtimes without installing missing ones', () => {
  let installed = true;
  let installs = 0;
  let configured = 0;
  const fake = fakeDependencies({
    resolveExecutable: () => installed ? '/system/codex' : null,
    installRuntime: async () => { installs += 1; },
    configureMcp: () => { configured += 1; },
  });
  const coordinator = new AgentBootstrapCoordinator(fake.dependencies);

  assert.equal(coordinator.connectIfInstalled('codex').phase, 'ready');
  installed = false;
  assert.equal(coordinator.connectIfInstalled('claude').phase, 'idle');
  assert.equal(installs, 0);
  assert.equal(configured, 1);
});

test('debug failure controls produce recoverable failed states', async () => {
  let failInstall = true;
  const fake = fakeDependencies({
    debugState: () => ({
      enabled: true,
      discoveryPolicy: 'managed-only',
      simulateInstallFailure: failInstall,
      simulateMcpFailure: false,
    }),
  });
  const coordinator = new AgentBootstrapCoordinator(fake.dependencies);
  coordinator.begin('codex');
  const settled = await coordinator.wait('codex');
  assert.equal(settled.phase, 'failed');
  assert.match(settled.error ?? '', /Simulated Agent installation failure/);

  failInstall = false;
  assert.equal(coordinator.begin('codex').phase, 'installing');
  assert.equal((await coordinator.wait('codex')).phase, 'ready');
});

test('Claude release platform mapping stays provider-shaped', () => {
  assert.equal(claudePlatform('darwin', 'arm64', false), 'darwin-arm64');
  assert.equal(claudePlatform('linux', 'x64', false), 'linux-x64');
  assert.equal(claudePlatform('linux', 'arm64', true), 'linux-arm64-musl');
  assert.equal(claudePlatform('win32', 'x64', false), 'win32-x64');
  assert.throws(() => claudePlatform('freebsd', 'x64', false), /does not publish/);
});

test('development fixtures can isolate discovery from developer-installed Agents', () => {
  assert.equal(initialAgentDiscoveryPolicy({}), 'auto');
  assert.equal(initialAgentDiscoveryPolicy({ STASHBASE_AGENT_DISCOVERY_POLICY: 'managed-only' }), 'auto');
  assert.equal(initialAgentDiscoveryPolicy({
    STASHBASE_AGENT_DEBUG: '1',
    STASHBASE_AGENT_DISCOVERY_POLICY: 'managed-only',
  }), 'managed-only');
  assert.equal(initialAgentDiscoveryPolicy({
    STASHBASE_AGENT_DEBUG: '1',
    STASHBASE_AGENT_DISCOVERY_POLICY: 'invalid',
  }), 'auto');
});

test('managed-only discovery ignores the global Agent without uninstalling it', () => {
  const previousRoot = process.env.STASHBASE_LOCAL_DATA_ROOT;
  const previousDebug = process.env.STASHBASE_AGENT_DEBUG;
  const previousCodexBin = process.env.STASHBASE_CODEX_BIN;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-agent-runtime-test-'));
  const systemExecutable = path.join(root, process.platform === 'win32' ? 'system-codex.exe' : 'system-codex');
  process.env.STASHBASE_LOCAL_DATA_ROOT = root;
  process.env.STASHBASE_AGENT_DEBUG = '1';
  process.env.STASHBASE_CODEX_BIN = systemExecutable;
  try {
    const executable = path.join(managedCodexBinDir(), process.platform === 'win32' ? 'codex.exe' : 'codex');
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, process.platform === 'win32' ? '' : '#!/bin/sh\nexit 0\n');
    fs.writeFileSync(systemExecutable, process.platform === 'win32' ? '' : '#!/bin/sh\nexit 0\n');
    if (process.platform !== 'win32') fs.chmodSync(executable, 0o755);
    if (process.platform !== 'win32') fs.chmodSync(systemExecutable, 0o755);

    setAgentRuntimeDebugState({ discoveryPolicy: 'auto' });
    assert.equal(resolveAgentCli({ name: 'codex', envNames: ['STASHBASE_CODEX_BIN'], logLabel: 'Codex' }), systemExecutable);
    setAgentRuntimeDebugState({ discoveryPolicy: 'managed-only' });
    assert.equal(resolveAgentCli({ name: 'codex', envNames: ['STASHBASE_CODEX_BIN'], logLabel: 'Codex' }), executable);
  } finally {
    setAgentRuntimeDebugState({ discoveryPolicy: 'auto', simulateInstallFailure: false, simulateMcpFailure: false });
    if (previousRoot === undefined) delete process.env.STASHBASE_LOCAL_DATA_ROOT;
    else process.env.STASHBASE_LOCAL_DATA_ROOT = previousRoot;
    if (previousDebug === undefined) delete process.env.STASHBASE_AGENT_DEBUG;
    else process.env.STASHBASE_AGENT_DEBUG = previousDebug;
    if (previousCodexBin === undefined) delete process.env.STASHBASE_CODEX_BIN;
    else process.env.STASHBASE_CODEX_BIN = previousCodexBin;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('explicit readiness finds a version-manager Agent through the login shell', { skip: process.platform === 'win32' }, () => {
  const previousShell = process.env.SHELL;
  const previousFakeBin = process.env.STASHBASE_TEST_SHELL_AGENT;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-agent-shell-test-'));
  const shell = path.join(root, 'fake-shell');
  const executable = path.join(root, 'version-manager-agent');
  fs.writeFileSync(shell, '#!/bin/sh\nprintf "%s\\n" "$STASHBASE_TEST_SHELL_AGENT"\n');
  fs.writeFileSync(executable, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(shell, 0o755);
  fs.chmodSync(executable, 0o755);
  process.env.SHELL = shell;
  process.env.STASHBASE_TEST_SHELL_AGENT = executable;
  try {
    assert.equal(
      resolveAgentCliWithLoginShell({ name: `stashbase-test-agent-${process.pid}`, envNames: [], logLabel: 'Test Agent' }),
      executable,
    );
  } finally {
    if (previousShell === undefined) delete process.env.SHELL;
    else process.env.SHELL = previousShell;
    if (previousFakeBin === undefined) delete process.env.STASHBASE_TEST_SHELL_AGENT;
    else process.env.STASHBASE_TEST_SHELL_AGENT = previousFakeBin;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
