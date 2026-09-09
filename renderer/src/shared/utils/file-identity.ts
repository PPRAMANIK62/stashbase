/** How this app tells one attached file from another.
 *
 *  Name, size and last-modified time together are unique enough to catch "the
 *  user dropped the same file twice" without false positives on legitimately
 *  distinct files: different bytes imply a different size often enough, and the
 *  timestamp separates the rest. Deliberately carries no index, so removing the
 *  first attachment does not re-key — and therefore remount — every surviving
 *  sibling.
 *
 *  The composer's de-duplication and the transcript's thumbnail keys are the
 *  same question asked twice; both read it from here. */

export function fileFingerprint(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
