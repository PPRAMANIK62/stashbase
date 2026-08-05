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

const RECOVERY_CASES = [
  {
    name: 'copy-failure',
    prepareSource: false,
    signer: 'real',
    expectedStage: 'copying StashBase.app without quarantine attributes',
  },
  {
    name: 'sign-failure',
    signer: 'fail',
    expectedStage: 'repairing the ad-hoc code signature',
  },
  {
    name: 'verification-failure',
    signer: 'corrupt',
    expectedStage: 'verifying the installed app bundle',
  },
  ...['INT', 'TERM', 'HUP'].map((signal) => ({
    name: `interrupt-${signal.toLowerCase()}`,
    signer: 'signal',
    signal,
    expectedStage: 'repairing the ad-hoc code signature',
  })),
  {
    name: 'remove-failure',
    signer: 'fail',
    rollbackCommand: 'remove',
    expectedRecoveryError: 'could not remove the failed replacement',
    expectedStage: 'repairing the ad-hoc code signature',
  },
  {
    name: 'restore-failure',
    signer: 'fail',
    rollbackCommand: 'restore',
    expectedRecoveryError: 'could not restore the previous app',
    expectedStage: 'repairing the ad-hoc code signature',
  },
  {
    name: 'success',
    signer: 'real',
    success: true,
  },
];

function replaceOnce(source, needle, replacement, label) {
  assert(source.includes(needle), `Could not instrument ${label}`);
  return source.replace(needle, replacement);
}

function helperForCase(helper, recoveryCase) {
  let instrumented = helper;
  if (recoveryCase.rollbackCommand === 'remove') {
    instrumented = replaceOnce(
      instrumented,
      '/bin/rm -rf "$TARGET_APP"',
      '/usr/bin/false',
      `${recoveryCase.name} remove failure`,
    );
  }
  if (recoveryCase.rollbackCommand === 'restore') {
    instrumented = replaceOnce(
      instrumented,
      '/bin/mv "$BACKUP_APP" "$TARGET_APP"',
      '/usr/bin/false',
      `${recoveryCase.name} restore failure`,
    );
  }
  return instrumented;
}

function writeSigner(signer, recoveryCase, realSigner, sentinel) {
  const common = `#!/bin/zsh
print -r -- invoked > ${JSON.stringify(sentinel)}
`;
  const source = recoveryCase.signer === 'fail'
    ? `${common}exit 1\n`
    : recoveryCase.signer === 'corrupt'
      ? `${common}print -r -- corrupt >> "$1/Contents/Resources/version.txt"\nexit 0\n`
      : recoveryCase.signer === 'signal'
        ? `${common}kill -${recoveryCase.signal} "$PPID"\n/bin/sleep 0.1\nexit 0\n`
        : `${common}exec /bin/zsh ${JSON.stringify(realSigner)} "$1"\n`;
  fs.writeFileSync(signer, source);
  fs.chmodSync(signer, 0o755);
}

function runCase(helper, realSigner, recoveryCase) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-macos-recovery-${recoveryCase.name}-`));
  const target = path.join(root, 'StashBase.app');
  const source = path.join(root, 'Source.app');
  const signer = path.join(root, 'sign.sh');
  const sentinel = path.join(root, 'signer-invoked');
  const helperPath = path.join(root, 'helper.sh');

  try {
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'version.txt'), 'old');
    if (recoveryCase.prepareSource !== false) writeSignedApp(source);
    writeSigner(signer, recoveryCase, realSigner, sentinel);
    fs.writeFileSync(helperPath, helperForCase(helper, recoveryCase));
    fs.chmodSync(helperPath, 0o755);

    const result = spawnSync('/bin/zsh', [helperPath, source, target, signer], { encoding: 'utf8' });
    assert(recoveryCase.success ? result.status === 0 : result.status !== 0, `${recoveryCase.name} returned the wrong status`);
    if (recoveryCase.prepareSource !== false) {
      assert(fs.existsSync(sentinel), `${recoveryCase.name} never invoked the signer`);
    }
    if (recoveryCase.success) {
      assert(fs.readFileSync(path.join(target, 'Contents', 'Resources', 'version.txt'), 'utf8') === 'new', 'success did not install the new app');
    } else if (recoveryCase.rollbackCommand) {
      assert(
        result.stderr.includes(`failed while ${recoveryCase.expectedStage}`),
        `${recoveryCase.name} did not fail at ${recoveryCase.expectedStage}`,
      );
      assert(
        result.stderr.includes(recoveryCase.expectedRecoveryError),
        `${recoveryCase.name} did not report the recovery failure`,
      );
      assert(
        result.stderr.includes('the previous app remains at'),
        `${recoveryCase.name} did not report the preserved backup`,
      );
    } else {
      assert(
        result.stderr.includes(`failed while ${recoveryCase.expectedStage}`),
        `${recoveryCase.name} did not fail at ${recoveryCase.expectedStage}`,
      );
      assert(
        fs.readFileSync(path.join(target, 'version.txt'), 'utf8') === 'old',
        `${recoveryCase.name} did not restore the previous app`,
      );
    }
    const leftovers = fs.readdirSync(root).filter((name) => name.includes('.stashbase-previous-'));
    const expectedLeftovers = recoveryCase.rollbackCommand ? 1 : 0;
    assert(
      leftovers.length === expectedLeftovers,
      `${recoveryCase.name} left ${leftovers.length} rollback bundles, expected ${expectedLeftovers}`,
    );
    if (recoveryCase.rollbackCommand) {
      assert(
        fs.readFileSync(path.join(root, leftovers[0], 'version.txt'), 'utf8') === 'old',
        `${recoveryCase.name} did not preserve the previous app in its backup`,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export function verifyMacosRecoveryInstaller(fixScript, realSigner) {
  if (process.platform !== 'darwin') throw new Error('macOS recovery installer verification must run on macOS.');

  const helper = helperFrom(fixScript);
  for (const recoveryCase of RECOVERY_CASES) {
    runCase(helper, realSigner, recoveryCase);
  }
}
