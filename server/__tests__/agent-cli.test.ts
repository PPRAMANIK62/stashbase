import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  agentCliExecutableCandidates,
  agentCliVersion,
  isWindowsLaunchableAgentCliPath,
  parseAgentCliVersion,
} from '../agent-cli.ts';

test('Windows agent CLI discovery prefers launchable shims over extensionless npm files', () => {
  assert.deepEqual(agentCliExecutableCandidates('codex', 'win32'), [
    'codex.exe',
    'codex.cmd',
    'codex.bat',
    'codex.com',
    'codex',
  ]);
  assert.equal(isWindowsLaunchableAgentCliPath('C:\\Users\\Alice\\AppData\\Roaming\\npm\\codex'), false);
  assert.equal(isWindowsLaunchableAgentCliPath('C:\\Users\\Alice\\AppData\\Roaming\\npm\\codex.cmd'), true);
});

test('non-Windows agent CLI discovery keeps bare command lookup', () => {
  assert.deepEqual(agentCliExecutableCandidates('codex', 'darwin'), ['codex']);
});

test('agent CLI version parsing reads the release number out of either provider format', () => {
  assert.equal(parseAgentCliVersion('2.1.220 (Claude Code)'), '2.1.220');
  assert.equal(parseAgentCliVersion('codex-cli 0.104.0\n'), '0.104.0');
  assert.equal(parseAgentCliVersion('Claude Code'), null);
});

test('agent CLI version is read once per executable change and never for a missing file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-cli-version-'));
  const file = path.join(dir, 'claude');
  fs.writeFileSync(file, '#!/bin/sh\n');
  let reads = 0;
  const read = () => `2.1.${++reads}`;
  try {
    assert.equal(agentCliVersion(file, read), '2.1.1');
    assert.equal(agentCliVersion(file, read), '2.1.1', 'the listing is polled; the executable is not re-run');
    const later = new Date(Date.now() + 5_000);
    fs.utimesSync(file, later, later);
    assert.equal(agentCliVersion(file, read), '2.1.2', 'an updater replacing the file in place is seen');
    assert.equal(agentCliVersion(path.join(dir, 'missing'), read), null);
    assert.equal(reads, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
