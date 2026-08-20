import { basename } from '@/common/lib/paths';
import { portableImageMarkdownPath, relativeLinkPath } from '@/common/lib/relativeLinkPath';

/** The Markdown link text and href the "Link to file…" slash-menu item
 * inserts once a target is chosen: `displayName` is the target's basename,
 * and `href` is the same note-relative, percent-encoded shape image
 * uploads already produce (see `portableImageMarkdownPath`), so the link
 * stays portable and round-trips through Milkdown's serializer. */
export function linkFileInsertionText(noteName: string, targetPath: string): { displayName: string; href: string } {
  return {
    displayName: basename(targetPath),
    href: portableImageMarkdownPath(relativeLinkPath(noteName, targetPath)),
  };
}
