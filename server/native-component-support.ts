import os from 'node:os';

/** The Intel native bundles use macOS 15 wheels. This is a capability limit,
 * never the minimum OS for opening the Electron application. */
export function nativeComponentUnavailable(
  platform: string = process.platform, arch: string = process.arch, release: string = os.release(),
): string | null {
  if (platform === 'darwin' && arch === 'x64' && Number.parseInt(release, 10) < 24) {
    return 'Local search and PDF/image text extraction require macOS 15 or later on Intel Macs. You can still open projects and edit files.';
  }
  return null;
}
