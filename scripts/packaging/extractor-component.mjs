/** Produce an immutable component archive and the app's pinned trust manifest. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import * as tar from 'tar';
import { extractorAssetName, extractorManifestSchema } from '../../shared/extractor-runtime.ts';

export async function buildExtractorComponent({ source, output, manifestPath, version, platform = process.platform, arch = process.arch }) {
  if (path.basename(source) !== 'stashbase-extract') throw new Error('Invalid extractor component directory');
  const executable = path.join(source, platform === 'win32' ? 'stashbase-extract.exe' : 'stashbase-extract');
  if (!(await fs.stat(executable)).isFile()) throw new Error('Extractor executable is missing');
  await fs.mkdir(output, { recursive: true });
  const asset = extractorAssetName(version, platform, arch);
  const archive = path.join(output, asset);
  await tar.c({ gzip: true, portable: true, cwd: path.dirname(source), file: archive }, [path.basename(source)]);
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  const manifest = extractorManifestSchema.parse({
    schema: 1, version, platform, arch, asset,
    sha256: hash.digest('hex'), sizeBytes: (await fs.stat(archive)).size,
  });
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2)+'\n');
  // Publish the same manifest for release verification; runtime trusts only
  // the copy embedded in its signed/installed application.
  await fs.writeFile(path.join(output, asset.replace(/\.tar\.gz$/, '.json')), JSON.stringify(manifest, null, 2)+'\n');
  return { archive, manifest };
}
