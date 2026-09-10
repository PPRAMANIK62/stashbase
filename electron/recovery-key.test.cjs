const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createRecoveryKeyProvider, RECOVERY_KEY_BYTES } = require('./recovery-key.cjs');

const WRAP_PREFIX = 'wrapped:';

function fakeSafeStorage({ available = true } = {}) {
  return {
    available,
    isEncryptionAvailable() { return this.available; },
    encryptString(text) {
      return Buffer.from(`${WRAP_PREFIX}${[...text].reverse().join('')}`, 'utf8');
    },
    decryptString(buffer) {
      const text = buffer.toString('utf8');
      if (!text.startsWith(WRAP_PREFIX)) throw new Error('not wrapped by this fake');
      return [...text.slice(WRAP_PREFIX.length)].reverse().join('');
    },
  };
}

function harness(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-key-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'nested', 'recovery-journal.key');
  const safeStorage = fakeSafeStorage(options);
  const warnings = [];
  const provider = createRecoveryKeyProvider({
    safeStorage,
    filePath,
    warn: (message) => warnings.push(message),
    ...(options.randomBytes ? { randomBytes: options.randomBytes } : {}),
    ...(options.fs ? { fs: options.fs } : {}),
  });
  return { dir, filePath, safeStorage, warnings, provider };
}

function keyBytes(key) {
  return Buffer.from(key, 'base64');
}

test('first load creates a wrapped 32-byte key and later loads return it', (t) => {
  const { filePath, provider, warnings } = harness(t);
  const first = provider.load();
  assert.equal(keyBytes(first).length, RECOVERY_KEY_BYTES);
  assert.ok(fs.existsSync(filePath));
  assert.equal(provider.load(), first);
  assert.equal(createRecoveryKeyProvider({ safeStorage: fakeSafeStorage(), filePath }).load(), first);
  assert.deepEqual(warnings, []);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
  }
});

test('the stored file never carries the key in plaintext', (t) => {
  const { filePath, provider } = harness(t);
  const key = provider.load();
  const stored = fs.readFileSync(filePath, 'utf8');
  assert.ok(!stored.includes(key));
  assert.ok(!Buffer.from(stored, 'base64').toString('utf8').includes(key));
});

test('without OS-protected storage there is no key and no file', (t) => {
  const { filePath, provider, safeStorage } = harness(t, { available: false });
  assert.equal(provider.load(), null);
  assert.equal(fs.existsSync(path.dirname(filePath)), false);
  safeStorage.available = true;
  assert.equal(keyBytes(provider.load()).length, RECOVERY_KEY_BYTES);
});

test('a corrupt file is replaced by a fresh key', (t) => {
  const { filePath, provider, warnings } = harness(t);
  const original = provider.load();
  fs.writeFileSync(filePath, Buffer.from('garbage').toString('base64'));
  const replaced = provider.load();
  assert.notEqual(replaced, original);
  assert.equal(keyBytes(replaced).length, RECOVERY_KEY_BYTES);
  assert.equal(provider.load(), replaced);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /could not be unwrapped/);
});

test('a wrong-length decrypted key is regenerated', (t) => {
  const { filePath, provider, safeStorage, warnings } = harness(t);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const short = Buffer.alloc(16, 7).toString('base64');
  fs.writeFileSync(filePath, safeStorage.encryptString(short).toString('base64'));
  const replaced = provider.load();
  assert.notEqual(replaced, short);
  assert.equal(keyBytes(replaced).length, RECOVERY_KEY_BYTES);
  assert.match(warnings[0], /malformed/);
});

test('a failed store still hands this run a usable key', (t) => {
  const failingFs = {
    ...fs,
    writeFileSync() { throw new Error('disk full'); },
  };
  const { filePath, provider, warnings } = harness(t, { fs: failingFs });
  const key = provider.load();
  assert.equal(keyBytes(key).length, RECOVERY_KEY_BYTES);
  assert.equal(fs.existsSync(filePath), false);
  assert.match(warnings[0], /could not be stored/);
});
