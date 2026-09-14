import { z } from 'zod';

/** Embedded in the app at build time, never fetched as executable authority. */
export const extractorManifestSchema = z.object({
  schema: z.literal(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/),
  platform: z.enum(['darwin', 'linux', 'win32']),
  arch: z.enum(['arm64', 'x64']),
  asset: z.string().regex(/^stashbase-extract-[A-Za-z0-9.-]+\.tar\.gz$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().positive().max(768 * 1024 * 1024),
}).strict();
export type ExtractorManifest = z.infer<typeof extractorManifestSchema>;

export function extractorAssetName(version: string, platform: string, arch: string): string {
  return `stashbase-extract-${version}-${platform}-${arch}.tar.gz`;
}

export function extractorDownloadUrl(manifest: ExtractorManifest): string {
  if (manifest.asset !== extractorAssetName(manifest.version, manifest.platform, manifest.arch)) {
    throw new Error('Extractor asset does not match its version and platform');
  }
  return `https://github.com/liliu-z/stashbase/releases/download/v${manifest.version}/${manifest.asset}`;
}
