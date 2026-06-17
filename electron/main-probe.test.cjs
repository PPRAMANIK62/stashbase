const assert = require('node:assert/strict');
const test = require('node:test');
const { isCompatibleServerHealth } = require('./main-probe.cjs');

const expected = {
  protocolVersion: 1,
  appRoot: '/Applications/StashBase.app/Contents/Resources/app.asar',
  resourcesPath: '/Applications/StashBase.app/Contents/Resources',
};

test('compatible health must match protocol and packaged identity', () => {
  assert.equal(isCompatibleServerHealth({
    app: 'stashbase',
    ok: true,
    protocolVersion: 1,
    appRoot: expected.appRoot,
    resourcesPath: expected.resourcesPath,
  }, expected), true);

  assert.equal(isCompatibleServerHealth({
    app: 'stashbase',
    ok: true,
    protocolVersion: 1,
    appRoot: '/tmp/old/StashBase.app/Contents/Resources/app.asar',
    resourcesPath: expected.resourcesPath,
  }, expected), false);

  assert.equal(isCompatibleServerHealth({
    app: 'stashbase',
    ok: true,
    protocolVersion: 1,
    appRoot: expected.appRoot,
    resourcesPath: '/tmp/old/StashBase.app/Contents/Resources',
  }, expected), false);
});

test('legacy health without identity is not compatible', () => {
  assert.equal(isCompatibleServerHealth({
    app: 'stashbase',
    ok: true,
    protocolVersion: 1,
  }, expected), false);
});
