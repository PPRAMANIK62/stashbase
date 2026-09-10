import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { githubImportApi } from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useGitHubImport } from './use-github-import';

afterEach(cleanup);

const URL = 'https://github.com/owner/repo';

function mount(port = githubImportApi(), onImported = vi.fn()) {
  const hook = renderHook(() => useGitHubImport(port, { onImported }), {
    wrapper: queryWrapper(createTestQueryClient()),
  });
  return { hook, onImported, port };
}

describe('useGitHubImport', () => {
  it('offers nothing to submit until a usable URL is typed', () => {
    const { hook } = mount();
    expect(hook.result.current.canSubmit).toBe(false);

    act(() => hook.result.current.setUrl(URL));
    expect(hook.result.current.canSubmit).toBe(true);
  });

  it('derives the folder name from the URL', () => {
    const { hook } = mount();
    act(() => hook.result.current.setUrl(URL));
    expect(hook.result.current.folderName).toBe('repo');
  });

  it('keeps a name the reader typed when they then fix the URL', () => {
    const { hook } = mount();
    act(() => hook.result.current.setUrl(URL));
    act(() => hook.result.current.setFolderName('my-notes'));
    act(() => hook.result.current.setUrl('https://github.com/owner/other'));

    expect(hook.result.current.folderName).toBe('my-notes');
  });

  it('says nothing about an empty field, and names an unusable URL once typed', () => {
    const { hook } = mount();
    expect(hook.result.current.urlIssue).toBeNull();

    act(() => hook.result.current.setUrl('https://gitlab.com/owner/repo'));
    expect(hook.result.current.urlIssue).not.toBeNull();
  });

  it('says a name problem under the name, not under the URL', () => {
    const { hook } = mount();
    act(() => hook.result.current.setUrl(URL));
    act(() => hook.result.current.setFolderName('a/b'));

    expect(hook.result.current.nameIssue).toBe('name cannot contain slashes');
    expect(hook.result.current.urlIssue).toBeNull();
  });

  it('refuses to submit a folder name the rule rejects', () => {
    const { hook } = mount();
    act(() => hook.result.current.setUrl(URL));
    act(() => hook.result.current.setFolderName('a/b'));

    expect(hook.result.current.nameIssue).toBe('name cannot contain slashes');
    expect(hook.result.current.canSubmit).toBe(false);
    act(() => hook.result.current.submit());
    expect(hook.result.current.pending).toBe(false);
  });

  it('hands the published path on, rather than opening the folder itself', async () => {
    const { hook, onImported, port } = mount();
    act(() => hook.result.current.setUrl(URL));
    act(() => hook.result.current.submit());

    await waitFor(() => expect(onImported).toHaveBeenCalledWith('/home/me/repo'));
    expect(port.run).toHaveBeenCalledWith(URL, 'repo', expect.anything());
  });

  it('reports a refusal without clearing what the reader typed', async () => {
    const port = githubImportApi({
      run: vi.fn(async () => {
        throw new Error('refused');
      }),
    });
    const { hook } = mount(port);
    act(() => hook.result.current.setUrl(URL));
    act(() => hook.result.current.submit());

    await waitFor(() => expect(hook.result.current.failure).not.toBeNull());
    expect(hook.result.current.url).toBe(URL);
    expect(hook.result.current.folderName).toBe('repo');
  });

  it('clears a standing refusal once the reader edits the URL', async () => {
    const port = githubImportApi({
      run: vi.fn(async () => {
        throw new Error('refused');
      }),
    });
    const { hook } = mount(port);
    act(() => hook.result.current.setUrl(URL));
    act(() => hook.result.current.submit());
    await waitFor(() => expect(hook.result.current.failure).not.toBeNull());

    act(() => hook.result.current.setUrl('https://github.com/owner/other'));
    expect(hook.result.current.failure).toBeNull();
  });

  it('cancels an open request so no partial member is left behind', async () => {
    let seen: AbortSignal | undefined;
    const port = githubImportApi({
      run: vi.fn((_url, _name, signal) => {
        seen = signal;
        return new Promise<string>(() => undefined);
      }),
    });
    const { hook } = mount(port);
    act(() => hook.result.current.setUrl(URL));
    act(() => hook.result.current.submit());
    await waitFor(() => expect(hook.result.current.pending).toBe(true));

    act(() => hook.result.current.cancel());
    expect(seen?.aborted).toBe(true);
  });
});
