/**
 * How the renderer reads a path as text.
 *
 * Every surface that shows a file asks the same two questions — what is this
 * called, and where does it sit — and the answers have to match across them:
 * a result row, a tree row, a tab, a mention chip and a delete confirmation
 * are all naming the same file, and a reader who saw one name in the sidebar
 * must not meet a different one in the dialog.
 *
 * Both separators are accepted wherever a path is read, because a path can
 * reach the renderer from a Windows host, and a trailing separator is trimmed
 * first so a folder path names the folder rather than an empty segment. These
 * are text operations on a path that is already resolved; nothing here builds
 * a path, resolves one, or decides what is inside a folder.
 */

const SEPARATORS = /[\\/]/u;
const TRAILING_SEPARATORS = /[\\/]+$/u;

/**
 * The last segment of a path: the file's or folder's own name.
 *
 * A path with no segment left to name — one that is nothing but separators —
 * answers with the path itself rather than an empty string, so a caller always
 * has something to put on screen.
 */
export function basePathName(path: string): string {
  const trimmed = path.replace(TRAILING_SEPARATORS, '');
  return trimmed.split(SEPARATORS).at(-1) || path;
}

/**
 * Everything before the last separator: where the entry sits.
 *
 * Empty when the path has no separator, which is what a row at the top of a
 * folder should say. Callers that need a location to show anyway substitute
 * the folder's own name; this function does not guess one.
 */
export function parentPathOf(path: string): string {
  const trimmed = path.replace(TRAILING_SEPARATORS, '');
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return cut === -1 ? '' : trimmed.slice(0, cut);
}

/** The lowercased extension without its dot, or `''` when the name carries
 *  none. A dotfile is a name, not an extension, so `.gitignore` has none. */
export function fileExtensionOf(path: string): string {
  const name = basePathName(path);
  const separator = name.lastIndexOf('.');
  return separator <= 0 ? '' : name.slice(separator + 1).toLowerCase();
}

/**
 * A folder-relative path made safe for one URL path segment at a time.
 *
 * Each segment is encoded on its own so the separators survive: encoding the
 * whole path would turn `a/b.md` into one segment named `a%2Fb.md`, which is a
 * different file. Four transports asked this same question and each answered
 * it for itself, which is three chances for one of them to start escaping the
 * separator too.
 */
export function encodePathSegments(relativePath: string): string {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}
