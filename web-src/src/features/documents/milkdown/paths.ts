/** Return an uploaded workspace path relative to the note that owns it. */
export function relativeAssetPath(noteName: string, uploadedPath: string): string {
  const noteDir = noteName.split('/').slice(0, -1).join('/');
  const prefix = noteDir ? `${noteDir}/` : '';
  return uploadedPath.startsWith(prefix) ? uploadedPath.slice(prefix.length) : uploadedPath;
}

export { portableImageMarkdownPath } from '@/common/lib/relativeLinkPath';
