import { execFileSync, spawnSync } from 'node:child_process';
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

function writeSignedApp(source) {
  fs.mkdirSync(path.join(source, 'Contents', 'MacOS'), { recursive: true });
  fs.mkdirSync(path.join(source, 'Contents', 'Resources'), { recursive: true });
  fs.copyFileSync('/usr/bin/true', path.join(source, 'Contents', 'MacOS', 'StashBase'));
  fs.chmodSync(path.join(source, 'Contents', 'MacOS', 'StashBase'), 0o755);
  fs.writeFileSync(path.join(source, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>StashBase</string><key>CFBundleIdentifier</key><string>ai.stashbase.recovery-test</string><key>CFBundleName</key><string>StashBase</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1</string></dict></plist>`);
  fs.writeFileSync(path.join(source, 'Contents', 'Resources', 'version.txt'), 'new');
  execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', source]);
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', source]);
}

function writeSigner(signer, mode, realSigner, sentinel) {
  const common = `#!/bin/zsh
print -r -- invoked > ${JSON.stringify(sentinel)}
`;
  const source = mode === 'sign'
    ? `${common}exit 1\n`
    : mode === 'verification'
      ? `${common}print -r -- corrupt >> "$1/Contents/Resources/version.txt"\nexit 0\n`
      : mode === 'interrupt'
        ? `${common}kill -TERM "$PPID"\n/bin/sleep 0.1\nexit 0\n`
        : `${common}exec /bin/zsh ${JSON.stringify(realSigner)} "$1"\n`;
  fs.writeFileSync(signer, source);
  fs.chmodSync(signer, 0o755);
}

function runCase(helper, realSigner, mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-macos-recovery-${mode}-`));
  const target = path.join(root, 'StashBase.app');
  const source = path.join(root, 'Source.app');
  const signer = path.join(root, 'sign.sh');
  const sentinel = path.join(root, 'signer-invoked');
  const helperPath = path.join(root, 'helper.sh');

  try {
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'version.txt'), 'old');
    if (mode !== 'copy') writeSignedApp(source);
    writeSigner(signer, mode, realSigner, sentinel);
    fs.writeFileSync(helperPath, helper);
    fs.chmodSync(helperPath, 0o755);

    const result = spawnSync('/bin/zsh', [helperPath, source, target, signer], { encoding: 'utf8' });
    const success = mode === 'success';
    assert(success ? result.status === 0 : result.status !== 0, `${mode} returned the wrong status`);
    if (mode !== 'copy') assert(fs.existsSync(sentinel), `${mode} never invoked the signer`);
    if (!success) {
      const expectedStage = mode === 'copy' ? 'copying StashBase.app without quarantine attributes'
        : mode === 'verification' ? 'verifying the installed app bundle'
          : 'repairing the ad-hoc code signature';
      assert(result.stderr.includes(`failed while ${expectedStage}`), `${mode} did not fail at ${expectedStage}`);
      assert(fs.readFileSync(path.join(target, 'version.txt'), 'utf8') === 'old', `${mode} did not restore the previous app`);
    } else {
      assert(fs.readFileSync(path.join(target, 'Contents', 'Resources', 'version.txt'), 'utf8') === 'new', 'success did not install the new app');
    }
    const leftovers = fs.readdirSync(root).filter((name) => name.includes('.stashbase-previous-'));
    assert(leftovers.length === 0, `${mode} left a rollback bundle behind`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export function verifyMacosRecoveryInstaller(fixScript, realSigner) {
  if (process.platform !== 'darwin') throw new Error('macOS recovery installer verification must run on macOS.');

  const helper = helperFrom(fixScript);
  for (const mode of ['copy', 'sign', 'verification', 'interrupt', 'success']) {
    runCase(helper, realSigner, mode);
  }
}
