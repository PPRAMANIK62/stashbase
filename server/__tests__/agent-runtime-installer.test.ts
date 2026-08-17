import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { mock } from 'node:test';
import { resolveAgentCli, resolveAgentCliWithLoginShell } from '../agent-cli.ts';
import {
  AgentBootstrapCoordinator,
  claudePlatform,
  installCodex,
  type AgentBootstrapDependencies,
} from '../agent-runtime-installer.ts';
import {
  consumeAgentSetupFailure,
  getAgentRuntimeDebugState,
  initialAgentDiscoveryPolicy,
  managedCodexBinDir,
  managedCodexInstallerHome,
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
    consumeFailure: () => false,
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

test('startup MCP repair does not consume the next explicit setup failure', () => {
  let nextFailure: 'mcp' | null = 'mcp';
  let configured = 0;
  const fake = fakeDependencies({
    resolveExecutable: () => '/system/codex',
    configureMcp: () => { configured += 1; },
    consumeFailure: (stage) => {
      if (nextFailure !== stage) return false;
      nextFailure = null;
      return true;
    },
  });
  const coordinator = new AgentBootstrapCoordinator(fake.dependencies);

  assert.equal(coordinator.connectIfInstalled('codex').phase, 'ready');
  assert.equal(configured, 1);
  assert.equal(nextFailure, 'mcp');
  assert.equal(coordinator.begin('codex').failure?.stage, 'mcp');
  assert.equal(nextFailure, null);
  assert.equal(configured, 1);
});

test('an injected installation failure is classified and consumed before retry', async () => {
  let nextFailure: 'installation' | 'mcp' | null = 'installation';
  const fake = fakeDependencies({
    consumeFailure: (stage) => {
      if (nextFailure !== stage) return false;
      nextFailure = null;
      return true;
    },
  });
  const coordinator = new AgentBootstrapCoordinator(fake.dependencies);
  const settled = coordinator.begin('codex');
  assert.equal(settled.phase, 'failed');
  assert.equal(settled.failure?.stage, 'installation');
  assert.equal(settled.failure?.code, 'simulated');
  assert.equal(settled.failure?.manualRecovery, undefined);
  assert.match(settled.failure?.message ?? '', /Simulated Agent installation failure/);

  assert.equal(coordinator.begin('codex').phase, 'installing');
  assert.equal((await coordinator.wait('codex')).phase, 'ready');
});

test('an injected MCP failure retries only MCP when the runtime exists', () => {
  let nextFailure: 'installation' | 'mcp' | null = 'mcp';
  let installs = 0;
  let configured = 0;
  const fake = fakeDependencies({
    resolveExecutable: () => '/system/codex',
    installRuntime: async () => { installs += 1; },
    configureMcp: () => { configured += 1; },
    consumeFailure: (stage) => {
      if (nextFailure !== stage) return false;
      nextFailure = null;
      return true;
    },
  });
  const coordinator = new AgentBootstrapCoordinator(fake.dependencies);

  const failed = coordinator.begin('codex');
  assert.equal(failed.failure?.stage, 'mcp');
  assert.equal(failed.failure?.code, 'simulated');
  assert.equal(failed.failure?.manualRecovery, undefined);
  assert.equal(installs, 0);
  assert.equal(configured, 0);

  assert.equal(coordinator.begin('codex').phase, 'ready');
  assert.equal(installs, 0);
  assert.equal(configured, 1);
});

test('real installation and MCP errors advertise only their relevant manual recovery', async () => {
  const installFailure = new AgentBootstrapCoordinator(fakeDependencies({
    installRuntime: async () => { throw new Error('download unavailable'); },
  }).dependencies);
  assert.equal(installFailure.begin('codex').phase, 'installing');
  const failedInstall = await installFailure.wait('codex');
  assert.equal(failedInstall.failure?.stage, 'installation');
  assert.equal(failedInstall.failure?.manualRecovery, 'install-command');

  const mcpFailure = new AgentBootstrapCoordinator(fakeDependencies({
    resolveExecutable: () => '/system/codex',
    configureMcp: () => { throw new Error('config is read-only'); },
  }).dependencies);
  const failedMcp = mcpFailure.begin('codex');
  assert.equal(failedMcp.failure?.stage, 'mcp');
  assert.equal(failedMcp.failure?.manualRecovery, 'mcp-settings');
});

test('Claude release platform mapping stays provider-shaped', () => {
  assert.equal(claudePlatform('darwin', 'arm64', false), 'darwin-arm64');
  assert.equal(claudePlatform('linux', 'x64', false), 'linux-x64');
  assert.equal(claudePlatform('linux', 'arm64', true), 'linux-arm64-musl');
  assert.equal(claudePlatform('win32', 'x64', false), 'win32-x64');
  assert.throws(() => claudePlatform('freebsd', 'x64', false), /does not publish/);
});

test('Codex post-install verification preserves the isolated installer environment', async () => {
  const previousRoot = process.env.STASHBASE_LOCAL_DATA_ROOT;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-codex-install-test-'));
  process.env.STASHBASE_LOCAL_DATA_ROOT = root;
  const installer = process.platform === 'win32'
    ? 'New-Item -ItemType File -Force -Path (Join-Path $env:CODEX_INSTALL_DIR "codex.exe") | Out-Null\n'
    : `#!/bin/sh
set -eu
: > "$CODEX_INSTALL_DIR/codex"
`;
  mock.method(globalThis, 'fetch', async () => new Response(installer));
  let verified = false;
  try {
    await installCodex(() => {}, new AbortController().signal, (executable, label, env) => {
      verified = true;
      assert.equal(executable, path.join(managedCodexBinDir(), process.platform === 'win32' ? 'codex.exe' : 'codex'));
      assert.equal(label, 'Codex');
      assert.equal(env.CODEX_INSTALL_DIR, managedCodexBinDir());
      assert.equal(env.CODEX_HOME, managedCodexInstallerHome());
    });
    assert.equal(verified, true);
  } finally {
    mock.restoreAll();
    if (previousRoot === undefined) delete process.env.STASHBASE_LOCAL_DATA_ROOT;
    else process.env.STASHBASE_LOCAL_DATA_ROOT = previousRoot;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('development fixtures can isolate discovery from developer-installed Agents', () => {
  assert.equal(initialAgentDiscoveryPolicy({}), 'auto');
  assert.equal(initialAgentDiscoveryPolicy({ STASHBASE_AGENT_DISCOVERY_POLICY: 'managed-only' }), 'auto');
  assert.equal(initialAgentDiscoveryPolicy({
    STASHBASE_DEV_RUNTIME: '1',
    STASHBASE_AGENT_DISCOVERY_POLICY: 'managed-only',
  }), 'managed-only');
  assert.equal(initialAgentDiscoveryPolicy({
    STASHBASE_DEV_VITE: '1',
    STASHBASE_AGENT_DISCOVERY_POLICY: 'system-only',
  }), 'system-only');
  assert.equal(initialAgentDiscoveryPolicy({
    STASHBASE_AGENT_DEBUG: '1',
    STASHBASE_AGENT_DISCOVERY_POLICY: 'managed-only',
  }), 'managed-only');
  assert.equal(initialAgentDiscoveryPolicy({
    STASHBASE_AGENT_DEBUG: '1',
    STASHBASE_AGENT_DISCOVERY_POLICY: 'invalid',
  }), 'auto');
});

test('development failure injection is mutually exclusive and one-shot', () => {
  const previousDebug = process.env.STASHBASE_AGENT_DEBUG;
  process.env.STASHBASE_AGENT_DEBUG = '1';
  try {
    setAgentRuntimeDebugState({ nextFailure: 'mcp' });
    assert.equal(getAgentRuntimeDebugState().nextFailure, 'mcp');
    assert.equal(consumeAgentSetupFailure('installation'), false);
    assert.equal(getAgentRuntimeDebugState().nextFailure, 'mcp');
    assert.equal(consumeAgentSetupFailure('mcp'), true);
    assert.equal(getAgentRuntimeDebugState().nextFailure, 'none');
    assert.equal(consumeAgentSetupFailure('mcp'), false);
  } finally {
    setAgentRuntimeDebugState({ nextFailure: 'none' });
    if (previousDebug === undefined) delete process.env.STASHBASE_AGENT_DEBUG;
    else process.env.STASHBASE_AGENT_DEBUG = previousDebug;
  }
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
    setAgentRuntimeDebugState({ discoveryPolicy: 'auto', nextFailure: 'none' });
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

test('the deferred startup pass probes the login shell; the boot pass never does', () => {
  const probes: Array<{ probeLoginShell?: boolean } | undefined> = [];
  let configured = 0;
  const fake = fakeDependencies({
    resolveExecutable: (_id, options) => {
      probes.push(options);
      // Only a login shell can resolve this runtime (nvm/homebrew paths).
      return options?.probeLoginShell ? '/login-shell/codex' : null;
    },
    configureMcp: () => { configured += 1; },
  });
  const coordinator = new AgentBootstrapCoordinator(fake.dependencies);

  // Synchronous boot pass: no probe, runtime invisible, no connect — boot
  // must stay quick and never spawn a shell.
  assert.equal(coordinator.connectIfInstalled('codex').phase, 'idle');
  assert.deepEqual(probes.at(-1), undefined);
  assert.equal(configured, 0);

  // Deferred pass: probes the login shell, finds the runtime, connects —
  // no waiting for the first New Chat.
  assert.equal(coordinator.connectIfInstalled('codex', { probeLoginShell: true }).phase, 'ready');
  assert.deepEqual(probes.at(-1), { probeLoginShell: true });
  assert.equal(configured, 1);
});
