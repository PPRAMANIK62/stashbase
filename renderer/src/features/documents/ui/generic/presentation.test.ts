import { describe, expect, it } from 'vite-plus/test';

import { formatFileSize, genericPreviewCopy } from './presentation';

describe('generic preview presentation', () => {
  it.each([
    ['binary', 'Binary file cannot be opened'],
    ['cloud-placeholder', 'File is not downloaded'],
    ['special', 'Filesystem entry cannot be opened'],
    ['symlink', 'Symbolic link cannot be opened'],
    ['too-large', 'File is too large to open'],
    ['unreadable', 'File cannot be read'],
  ] as const)('keeps the %s refusal truthful', (kind, title) => {
    expect(genericPreviewCopy({ kind, name: 'source' }).title).toBe(title);
  });

  it('formats bounded file metadata compactly', () => {
    expect(formatFileSize(42)).toBe('42 B');
    expect(formatFileSize(1_250)).toBe('1.3 kB');
    expect(formatFileSize(8_500_000)).toBe('8.5 MB');
  });
});
