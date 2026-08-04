import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function helperFrom(fixScript) {
  const source = fs.readFileSync(fixScript, 'utf8');
  const match = source.match(/<<'EOS'\n([\s\S]*?)\nEOS\n/);
  if (!match) throw new Error(`Could not find the privileged helper in ${fixScript}`);
  return match[1];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runFailureCase(helper, stage) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-macos-recovery-${stage}-`));
  const target = path.join(root, 'StashBase.app');
  const source = path.join(root, 'Source.app');
  const signer = path.join(root, 'sign.sh');
  const helperPath = path.join(root, 'helper.sh');

  try {
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'version.txt'), 'old');
    if (stage !== 'copy') {
      fs.mkdirSync(source);
      fs.writeFileSync(path.join(source, 'version.txt'), 'new');
    }

    fs.writeFileSync(signer, stage === 'sign' ? '#!/bin/zsh\nexit 1\n' : '#!/bin/zsh\nexit 0\n');
    fs.writeFileSync(helperPath, helper);
    fs.chmodSync(signer, 0o755);
    fs.chmodSync(helperPath, 0o755);

    const result = spawnSync('/bin/zsh', [helperPath, source, target, signer], {
      encoding: 'utf8',
    });

    assert(result.status !== 0, `${stage} failure unexpectedly completed`);
    assert(fs.readFileSync(path.join(target, 'version.txt'), 'utf8') === 'old', `${stage} failure did not restore the previous app`);
    const leftovers = fs.readdirSync(root).filter((name) => name.includes('.stashbase-previous-'));
    assert(leftovers.length === 0, `${stage} failure left a rollback bundle behind`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export function verifyMacosRecoveryInstaller(fixScript) {
  if (process.platform !== 'darwin') {
    throw new Error('macOS recovery installer verification must run on macOS.');
  }

  const helper = helperFrom(fixScript);
  for (const stage of ['copy', 'sign', 'verification']) runFailureCase(helper, stage);
}
