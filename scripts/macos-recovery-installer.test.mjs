import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMacosRecoveryInstaller } from './verify-macos-recovery-installer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('macOS recovery installer restores the previous app after every failed replacement stage', {
  skip: process.platform !== 'darwin',
}, () => {
  verifyMacosRecoveryInstaller(
    path.join(root, 'build', 'dmg-scripts', 'Fix.sh'),
    path.join(root, 'scripts', 'sign-macos-app.sh'),
  );
});
