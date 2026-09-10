const RECOVERY_KEY_BYTES = 32;
const KEY_FILE_MODE = 0o600;
const KEY_DIRECTORY_MODE = 0o700;

function isKeyBase64(candidate) {
  if (typeof candidate !== 'string') return false;
  const bytes = Buffer.from(candidate, 'base64');
  return bytes.length === RECOVERY_KEY_BYTES && bytes.toString('base64') === candidate;
}

/** One random journal key per installation, wrapped at rest with Electron
 * safeStorage. Returns null when the OS offers no protected storage so the
 * server keeps recovery disabled rather than falling back to plaintext. */
function createRecoveryKeyProvider({
  safeStorage,
  filePath,
  fs = require('node:fs'),
  randomBytes = require('node:crypto').randomBytes,
  warn = console.warn,
}) {
  const path = require('node:path');

  function readStored() {
    let wrapped;
    try {
      wrapped = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      warn(`[electron] recovery journal key unreadable: ${err?.message ?? err}; generating a new one`);
      return null;
    }
    try {
      const key = safeStorage.decryptString(Buffer.from(wrapped.trim(), 'base64'));
      if (isKeyBase64(key)) return key;
      warn('[electron] recovery journal key is malformed; generating a new one');
    } catch (err) {
      warn(`[electron] recovery journal key could not be unwrapped: ${err?.message ?? err}; generating a new one`);
    }
    return null;
  }

  function store(key) {
    const wrapped = safeStorage.encryptString(key).toString('base64');
    const temp = `${filePath}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: KEY_DIRECTORY_MODE });
      fs.writeFileSync(temp, wrapped, { encoding: 'utf8', mode: KEY_FILE_MODE });
      fs.renameSync(temp, filePath);
      if (process.platform !== 'win32') {
        try { fs.chmodSync(filePath, KEY_FILE_MODE); } catch { /* best effort on special filesystems */ }
      }
    } catch (err) {
      try { fs.rmSync(temp, { force: true }); } catch { /* best effort */ }
      warn(`[electron] recovery journal key could not be stored: ${err?.message ?? err}; drafts from this run will not survive the next launch`);
    }
  }

  return {
    load() {
      if (!safeStorage.isEncryptionAvailable()) return null;
      const stored = readStored();
      if (stored) return stored;
      const fresh = randomBytes(RECOVERY_KEY_BYTES).toString('base64');
      store(fresh);
      return fresh;
    },
  };
}

module.exports = { createRecoveryKeyProvider, RECOVERY_KEY_BYTES };
