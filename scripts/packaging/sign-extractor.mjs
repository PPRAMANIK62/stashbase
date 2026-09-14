/** macOS executable components are Developer ID signed and notarized before
 * hashing. Their independent release archive retains those exact bytes. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertMacosReleaseCredentials } from '../macos-release-contract.mjs';

export async function signExtractorComponent(source, options = {}) {
  const env = options.env ?? process.env;
  if ((options.platform ?? process.platform) !== 'darwin') return;
  const mode = assertMacosReleaseCredentials(env);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'stashbase-extractor-sign-'));
  let keychain;
  let originalSearchList;
  const execute = options.run ?? ((cmd, args) => execFileSync(cmd, args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20 * 60_000,
  }));
  const run = (cmd, args) => {
    try { return execute(cmd, args); }
    catch (error) {
      // ChildProcess messages echo arguments, including keychain passwords.
      // Only codesign stderr describes the failing binary without auth arguments.
      let diagnostic = cmd === 'codesign' ? String(error.stderr ?? '').trim() : '';
      for (const [name, value] of Object.entries(env)) {
        if (/^(CSC_|APPLE_)/.test(name) && value) diagnostic = diagnostic.replaceAll(value, '[redacted]');
      }
      throw new Error(`${cmd} failed while signing the extractor (exit ${error.status ?? 'unknown'})${diagnostic ? `: ${diagnostic}` : ''}`);
    }
  };
  try {
    if (env.CSC_LINK) {
      const password = crypto.randomBytes(24).toString('hex');
      keychain = path.join(temporary, 'signing.keychain-db');
      const certificate = path.join(temporary, 'identity.p12');
      // Release CI provides the base64 P12. Local signing may use a file.
      const link = env.CSC_LINK;
      const bytes = await fs.readFile(link).catch(() => Buffer.from(link, 'base64'));
      await fs.writeFile(certificate, bytes, { mode: 0o600 });
      originalSearchList = [...run('security', ['list-keychains', '-d', 'user']).matchAll(/^\s*"(.+)"\s*$/gm)]
        .map((match) => match[1]);
      run('security', ['create-keychain', '-p', password, keychain]);
      run('security', ['unlock-keychain', '-p', password, keychain]);
      run('security', ['import', certificate, '-k', keychain, '-P', env.CSC_KEY_PASSWORD ?? '', '-T', '/usr/bin/codesign']);
      run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', password, keychain]);
      // --keychain narrows identity matching; codesign still resolves signing
      // material through the user's search list. Preserve all existing entries.
      run('security', ['list-keychains', '-d', 'user', '-s', keychain, ...originalSearchList]);
    }
    const keychainArgs = keychain ? [keychain] : [];
    const identities = run('security', ['find-identity', '-v', '-p', 'codesigning', ...keychainArgs]);
    const matches = [...identities.matchAll(/([A-Fa-f0-9]{40}) "Developer ID Application:[^"]+"/g)];
    if (matches.length !== 1) throw new Error('Extractor signing requires exactly one Developer ID Application identity');
    const identity = matches[0][1];
    const binaries = [];
    const frameworks = [];
    async function walk(directory) {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await walk(filename);
          if (filename.endsWith('.framework')) frameworks.push(filename);
        }
        else if (entry.isFile()) {
          const file = await fs.open(filename, 'r');
          const magic = Buffer.alloc(4);
          try { await file.read(magic, 0, 4, 0); } finally { await file.close(); }
          if (['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe', 'cafebabf'].includes(magic.toString('hex'))) binaries.push(filename);
        }
      }
    }
    await walk(source);
    for (const filename of [...binaries, ...frameworks]) {
      run('codesign', ['--force', '--options', 'runtime', '--timestamp', '--sign', identity,
        ...(keychain ? ['--keychain', keychain] : []), filename]);
      run('codesign', ['--verify', '--strict', filename]);
    }
    const archive = path.join(temporary, 'extractor.zip');
    run('ditto', ['-c', '-k', '--keepParent', source, archive]);
    const authentication = mode === 'api-key'
      ? ['--key', env.APPLE_API_KEY, '--key-id', env.APPLE_API_KEY_ID, '--issuer', env.APPLE_API_ISSUER]
      : mode === 'apple-id'
        ? ['--apple-id', env.APPLE_ID, '--password', env.APPLE_APP_SPECIFIC_PASSWORD, '--team-id', env.APPLE_TEAM_ID]
        : ['--keychain-profile', env.APPLE_KEYCHAIN_PROFILE];
    const result = JSON.parse(run('xcrun', ['notarytool', 'submit', archive, ...authentication, '--wait', '--output-format', 'json']));
    if (result.status !== 'Accepted') throw new Error(`Extractor notarization failed: ${result.id} (${result.status})`);
    console.log(`[extractor-component] signed ${binaries.length} Mach-O files; notarization ${result.id} accepted`);
  } finally {
    try {
      if (originalSearchList) run('security', ['list-keychains', '-d', 'user', '-s', ...originalSearchList]);
    } finally {
      if (keychain) { try { run('security', ['delete-keychain', keychain]); } catch { /* temporary keychain cleanup */ } }
      await fs.rm(temporary, { recursive: true, force: true });
    }
  }
}
