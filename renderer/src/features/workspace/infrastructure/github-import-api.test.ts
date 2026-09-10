import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createGitHubImportAdapter } from './github-import-api';

function adapter(client: Partial<HttpClient> = {}) {
  return createGitHubImportAdapter({
    request: vi.fn(async () => ({ body: { path: '/home/me/repo' }, status: 200 })),
    ...client,
  } as HttpClient);
}

const signal = () => new AbortController().signal;

describe('GitHub import adapter', () => {
  it('derives the destination name the server would derive', () => {
    expect(adapter().readUrl('https://github.com/owner/repo')).toEqual({
      folderName: 'repo',
      ok: true,
    });
  });

  it('refuses a URL with the repository contract, not a second approximation', () => {
    expect(adapter().readUrl('http://github.com/owner/repo')).toEqual({
      message: 'Only HTTPS GitHub URLs are supported.',
      ok: false,
    });
    expect(adapter().readUrl('https://gitlab.com/owner/repo').ok).toBe(false);
    expect(adapter().readUrl('https://github.com/owner').ok).toBe(false);
  });

  it('refuses a destination name with the shared folder-name rule', () => {
    expect(adapter().folderNameIssue('notes')).toBeNull();
    expect(adapter().folderNameIssue('a/b')).toBe('name cannot contain slashes');
    expect(adapter().folderNameIssue('.hidden')).toBe('name cannot start with "."');
  });

  it('sends the pasted URL and the chosen name, and answers the published path', async () => {
    const request = vi.fn(async () => ({ body: { path: '/home/me/notes' }, status: 200 }));
    const path = await adapter({ request }).run(
      'https://github.com/owner/repo',
      'notes',
      signal(),
    );

    expect(path).toBe('/home/me/notes');
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { folderName: 'notes', url: 'https://github.com/owner/repo' },
        method: 'POST',
        path: '/api/github/import',
      }),
    );
  });

  it('reads each refusal from its code rather than the server prose', async () => {
    const cases = [
      ['UNSUPPORTED_LFS', 'Repositories that use Git LFS are not supported yet.'],
      ['UNSUPPORTED_SUBMODULES', 'Repositories with submodules are not supported yet.'],
      ['PRIVATE_OR_NOT_FOUND', 'That repository is private or does not exist.'],
      ['DESTINATION_EXISTS', 'A folder with that name already exists. Choose a different name.'],
      ['GIT_NOT_AVAILABLE', 'Importing needs Git installed and on your PATH.'],
    ] as const;

    for (const [code, message] of cases) {
      const request = vi.fn(async () => ({
        body: { code, error: 'raw server prose the reader never sees' },
        status: 400,
      }));
      await expect(
        adapter({ request }).run('https://github.com/owner/repo', 'notes', signal()),
      ).rejects.toMatchObject({ kind: 'rejected', message });
    }
  });

  it('falls back to the server sentence when a refusal carries no code', async () => {
    const request = vi.fn(async () => ({ body: { error: 'Something specific.' }, status: 400 }));
    await expect(
      adapter({ request }).run('https://github.com/owner/repo', 'notes', signal()),
    ).rejects.toMatchObject({ message: 'Something specific.' });
  });
});
