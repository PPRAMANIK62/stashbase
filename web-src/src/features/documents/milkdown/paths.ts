/** Return an uploaded workspace path relative to the note that owns it. */
export function relativeAssetPath(noteName: string, uploadedPath: string): string {
  const noteDir = noteName.split('/').slice(0, -1).join('/');
  const prefix = noteDir ? `${noteDir}/` : '';
  return uploadedPath.startsWith(prefix) ? uploadedPath.slice(prefix.length) : uploadedPath;
}

/** Return `targetPath` relative to the directory containing `noteName`, both
 * workspace-relative POSIX file paths within the same member folder root.
 * Unlike {@link relativeAssetPath} (prefix-stripping only, correct for
 * uploads that are always co-located with the note), this handles a target in
 * a different directory — producing `../` segments when needed — with a real
 * `path.relative`-style resolution rather than a prefix check.
 *
 * This deliberately does not import `node:path`: Vite externalizes Node
 * builtins for the renderer bundle (confirmed via `pnpm build:web`, which
 * logs "Module \"node:path\" has been externalized for browser
 * compatibility"), and the resulting shim throws when actually called at
 * runtime. `path.posix` semantics are reproduced by hand instead. */
export function relativeLinkPath(noteName: string, targetPath: string): string {
  const noteDirSegments = noteName.split('/').slice(0, -1);
  const targetSegments = targetPath.split('/');
  const targetDirSegments = targetSegments.slice(0, -1);
  const targetFile = targetSegments[targetSegments.length - 1];

  let common = 0;
  while (
    common < noteDirSegments.length
    && common < targetDirSegments.length
    && noteDirSegments[common] === targetDirSegments[common]
  ) {
    common++;
  }

  const upSegments = noteDirSegments.slice(common).map(() => '..');
  const downSegments = targetDirSegments.slice(common);
  return [...upSegments, ...downSegments, targetFile].join('/');
}

/** Keep image Markdown portable; DOM rendering resolves this path against the
 * active note's asset URL only after Milkdown has parsed it. */
export function portableImageMarkdownPath(relativePath: string): string {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}
