import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertMacosReleaseCredentials } from './macos-release-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const apiCredentials = {
  APPLE_API_KEY: '/tmp/AuthKey_TEST.p8',
  APPLE_API_KEY_ID: 'TESTKEY123',
  APPLE_API_ISSUER: '00000000-0000-0000-0000-000000000000',
};
const existingFile = { fileExists: () => true };

test('macOS release credentials fail closed and accept one complete notarization mode', () => {
  assert.throws(
    () => assertMacosReleaseCredentials({ GITHUB_ACTIONS: 'true', ...apiCredentials }, existingFile),
    /CSC_LINK and CSC_KEY_PASSWORD/,
  );
  assert.throws(
    () => assertMacosReleaseCredentials({ APPLE_API_KEY: apiCredentials.APPLE_API_KEY }, existingFile),
    /APPLE_API_KEY_ID, APPLE_API_ISSUER/,
  );
  assert.throws(
    () => assertMacosReleaseCredentials({}, existingFile),
    /exactly one notarization credential set/,
  );
  assert.throws(
    () => assertMacosReleaseCredentials({
      ...apiCredentials,
      APPLE_ID: 'release@example.com',
      APPLE_APP_SPECIFIC_PASSWORD: 'password',
      APPLE_TEAM_ID: 'TEAMID1234',
    }, existingFile),
    /must not configure multiple/,
  );
  assert.equal(
    assertMacosReleaseCredentials({
      GITHUB_ACTIONS: 'true',
      CSC_LINK: 'base64-p12',
      CSC_KEY_PASSWORD: 'password',
      ...apiCredentials,
    }, existingFile),
    'api-key',
  );
  assert.equal(
    assertMacosReleaseCredentials({
      APPLE_ID: 'release@example.com',
      APPLE_APP_SPECIFIC_PASSWORD: 'password',
      APPLE_TEAM_ID: 'TEAMID1234',
    }),
    'apple-id',
  );
  assert.equal(
    assertMacosReleaseCredentials({ APPLE_KEYCHAIN_PROFILE: 'stashbase-notary' }),
    'keychain',
  );
});

test('macOS package configuration requires Developer ID signing and notarization', () => {
  const pkg = JSON.parse(source('package.json'));
  const mac = pkg.build.mac;
  const dmgEntries = pkg.build.dmg.contents.map((entry) => entry.path).filter(Boolean);

  assert.equal(Object.hasOwn(mac, 'identity'), false);
  assert.equal(mac.hardenedRuntime, true);
  assert.equal(mac.notarize, true);
  assert.equal(mac.entitlements, 'build/entitlements.mac.plist');
  assert.equal(mac.entitlementsInherit, 'build/entitlements.mac.inherit.plist');
  assert.equal(pkg.build.dmg.sign, false);
  assert.deepEqual(dmgEntries, ['/Applications']);

  for (const entitlements of [
    source('build/entitlements.mac.plist'),
    source('build/entitlements.mac.inherit.plist'),
  ]) {
    assert.match(entitlements, /com\.apple\.security\.cs\.allow-jit/);
    assert.doesNotMatch(entitlements, /allow-unsigned-executable-memory|get-task-allow/);
  }
});

test('macOS release adapters preserve the final signature and require its verification', () => {
  const packager = source('scripts/package-desktop.mjs');
  assert.match(packager, /--config\.forceCodeSigning=true/);
  assert.doesNotMatch(packager, /CSC_IDENTITY_AUTO_DISCOVERY/);
  assert.doesNotMatch(packager, /clearQuarantine\(\['release\.nosync'/);

  const afterPack = source('scripts/after-pack-macos.cjs');
  assert.match(afterPack, /ditto.*--noextattr/s);
  assert.doesNotMatch(afterPack, /execFileSync\([^\n]+codesign|sign-macos-app|\/bin\/zsh/);

  const workflow = source('.github/workflows/release-macos.yml');
  for (const secret of [
    'MAC_CSC_LINK',
    'MAC_CSC_KEY_PASSWORD',
    'APPLE_API_KEY_P8',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER',
  ]) {
    assert.match(workflow, new RegExp(`secrets\\.${secret}`));
  }
  assert.match(workflow, /base64 -D/);
  assert.match(workflow, /APPLE_API_KEY=.*GITHUB_ENV/);

  const publisher = source('scripts/publish-github-release.mjs');
  assert.match(publisher, /STASHBASE_RELEASE_BUILD = '1'/);
  assert.match(publisher, /release-verify-mac\.mjs/);
  assert.ok(
    publisher.indexOf('release-verify-mac.mjs') < publisher.indexOf('const artifacts = listArtifacts()'),
    'the final macOS artifact must be verified before upload discovery',
  );

  const cask = source('scripts/publish-homebrew.mjs');
  assert.doesNotMatch(cask, /postflight|sign-macos-app|xattr/);

  const verifier = source('scripts/release-verify-mac.mjs');
  assert.match(verifier, /codesign/);
  assert.match(verifier, /spctl/);
  assert.match(verifier, /stapler/);

  for (const removed of [
    'build/dmg-scripts/Fix.sh',
    'build/dmg-scripts/Read Me.txt',
    'scripts/sign-macos-app.sh',
  ]) {
    assert.equal(fs.existsSync(path.join(root, removed)), false, `${removed} must stay retired`);
  }
});
