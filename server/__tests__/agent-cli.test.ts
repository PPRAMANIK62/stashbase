import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentCliExecutableCandidates,
  getCliSearchDirs,
  isWindowsLaunchableAgentCliPath,
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

test('CLI search directories include Node version manager and global package manager paths', () => {
  const dirs = getCliSearchDirs();
  assert.ok(Array.isArray(dirs));
  assert.ok(dirs.length > 0);
  assert.ok(dirs.some((d) => d.includes('.npm-global') || d.includes('.local') || d.includes('.nvm')));
});
