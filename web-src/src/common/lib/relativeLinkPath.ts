/** Workspace-relative link path helpers, shared by the Markdown editor
 * (image uploads, "Link to file…") and the file tree's "Copy Link" action —
 * store/ may depend only on common/, so this cannot live under
 * features/documents/ even though the editor is its main consumer. */

/** Return `targetPath` relative to the directory containing `noteName`, both
 * workspace-relative POSIX file paths within the same member folder root.
 * A real `path.relative`-style resolution — producing `../` segments when
 * needed — not a prefix check.
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

/** Keep relative Markdown link/image paths portable; DOM rendering resolves
 * this path against the active note's asset URL only after Milkdown has
 * parsed it. */
export function portableImageMarkdownPath(relativePath: string): string {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}
