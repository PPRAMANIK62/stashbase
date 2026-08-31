/**
 * Unit and interaction tests for ImportGitHubModal:
 * URL normalization, repo name extraction, folder name derivation,
 * input validation, controlled inputs, error handling, cancellation,
 * and success flow.
 */
import '@/common/__tests__/domEnvironment';
import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement as h } from 'react';
import { appActions, appState, mountApp, withDom } from '@/common/__tests__/renderHarness';
import {
  extractGitHubRepoName,
  ImportGitHubModal,
  isValidGitHubRepoUrl,
} from '@/features/workspace/components/ImportGitHubModal';
import { OverlayStackProvider } from '@/common/components/OverlayStack';
import { api, ApiError } from '@/common/api/api';

// Preload lazy modal chunks in node test environment
await import('@/common/components/ManagedModalShell');
await import('@/features/workspace/components/ManagedImportGitHubModal');

function wrapModal(onClose: () => void) {
  return h(OverlayStackProvider, null, h(ImportGitHubModal, { onClose }));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

test('extractGitHubRepoName extracts repository names accurately', () => {
  assert.equal(extractGitHubRepoName('https://github.com/owner/my-repo'), 'my-repo');
  assert.equal(extractGitHubRepoName('https://github.com/owner/my-repo.git'), 'my-repo');
  assert.equal(extractGitHubRepoName('https://github.com/owner/my-repo/'), 'my-repo');
  assert.equal(extractGitHubRepoName('https://github.com/Priyansh19077/CP-Templates'), 'CP-Templates');
  assert.equal(extractGitHubRepoName('https://github.com/owner'), '');
  assert.equal(extractGitHubRepoName('https://gitlab.com/owner/repo'), '');
  assert.equal(extractGitHubRepoName('not-a-url'), '');
});

test('isValidGitHubRepoUrl enforces HTTPS github.com owner/repo without credentials, query, or hash', () => {
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo'), true);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo.git'), true);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo/'), true);

  assert.equal(isValidGitHubRepoUrl('http://github.com/owner/repo'), false);
  assert.equal(isValidGitHubRepoUrl('https://gitlab.com/owner/repo'), false);
  assert.equal(isValidGitHubRepoUrl('https://user:pass@github.com/owner/repo'), false);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo?ref=main'), false);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo#readme'), false);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo/tree/main'), false);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner'), false);
  assert.equal(isValidGitHubRepoUrl(''), false);
});

test('ImportGitHubModal auto-populates folder name and destination from URL', async () => {
  await withDom(async (dom) => {
    let closed = false;
    await mountApp(dom, wrapModal(() => { closed = true; }), {
      state: appState({ workspace: { homeDir: '/Users/test/StashBase' } }),
    });
    await dom.flush();

    const urlInput = dom.query('#github-import-url') as HTMLInputElement;
    const folderInput = dom.query('#github-import-folder-name') as HTMLInputElement;
    const submitBtn = dom.queryAll('button').find((b) => b.textContent?.includes('Import and Open')) as HTMLButtonElement;

    assert.ok(urlInput, 'URL input rendered');
    assert.ok(folderInput, 'Folder name input rendered');
    assert.ok(submitBtn, 'Submit button rendered');
    assert.equal(submitBtn.disabled, true, 'Submit button initially disabled');

    // Type a valid GitHub URL
    await act(async () => {
      setInputValue(urlInput, 'https://github.com/Priyansh19077/CP-Templates');
    });

    assert.equal(folderInput.value, 'CP-Templates', 'Folder name auto-derived from URL');
    assert.equal(submitBtn.disabled, false, 'Submit button enabled for valid URL and folder name');

    // Type custom folder name
    await act(async () => {
      setInputValue(folderInput, 'My-CP-Templates');
    });

    assert.equal(folderInput.value, 'My-CP-Templates');
    assert.equal(submitBtn.disabled, false);
  });
});

test('ImportGitHubModal submits import and opens destination on success', async () => {
  await withDom(async (dom) => {
    let closed = false;
    const openedFolders: string[] = [];
    const originalImport = api.importPublicGitHubRepository;

    try {
      api.importPublicGitHubRepository = async (input) => {
        assert.equal(input.url, 'https://github.com/Priyansh19077/CP-Templates');
        assert.equal(input.folderName, 'CP-Templates');
        return { path: '/Users/test/StashBase/CP-Templates' };
      };

      await mountApp(dom, wrapModal(() => { closed = true; }), {
        state: appState({ workspace: { homeDir: '/Users/test/StashBase' } }),
        actions: appActions({
          openFolder: async (path) => { openedFolders.push(path); },
        }),
      });
      await dom.flush();

      const urlInput = dom.query('#github-import-url') as HTMLInputElement;
      const submitBtn = dom.queryAll('button').find((b) => b.textContent?.includes('Import and Open')) as HTMLButtonElement;

      await act(async () => {
        setInputValue(urlInput, 'https://github.com/Priyansh19077/CP-Templates');
      });

      await dom.fire(submitBtn, new MouseEvent('click', { bubbles: true }));

      assert.equal(closed, true, 'Modal closed on successful import');
      assert.deepEqual(openedFolders, ['/Users/test/StashBase/CP-Templates'], 'Imported folder was opened');
    } finally {
      api.importPublicGitHubRepository = originalImport;
    }
  });
});

test('ImportGitHubModal displays inline error and keeps inputs on failure', async () => {
  await withDom(async (dom) => {
    let closed = false;
    const originalImport = api.importPublicGitHubRepository;

    try {
      api.importPublicGitHubRepository = async () => {
        throw new ApiError('A folder named "CP-Templates" already exists in your folder home.', 409, 'DESTINATION_EXISTS');
      };

      await mountApp(dom, wrapModal(() => { closed = true; }), {
        state: appState({ workspace: { homeDir: '/Users/test/StashBase' } }),
      });
      await dom.flush();

      const urlInput = dom.query('#github-import-url') as HTMLInputElement;
      const folderInput = dom.query('#github-import-folder-name') as HTMLInputElement;
      const submitBtn = dom.queryAll('button').find((b) => b.textContent?.includes('Import and Open')) as HTMLButtonElement;

      await act(async () => {
        setInputValue(urlInput, 'https://github.com/Priyansh19077/CP-Templates');
      });

      await dom.fire(submitBtn, new MouseEvent('click', { bubbles: true }));

      assert.equal(closed, false, 'Modal remains open on error');
      const errorMsg = dom.query('[role="alert"]');
      assert.ok(errorMsg, 'Inline error alert rendered');
      assert.match(errorMsg.textContent ?? '', /already exists/);
      assert.equal(urlInput.value, 'https://github.com/Priyansh19077/CP-Templates', 'URL input preserved');
      assert.equal(folderInput.value, 'CP-Templates', 'Folder name input preserved');
    } finally {
      api.importPublicGitHubRepository = originalImport;
    }
  });
});
