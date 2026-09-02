import '@/common/__tests__/domEnvironment';
import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement as h } from 'react';
import { appActions, appState, mountApp, withDom } from '@/common/__tests__/renderHarness';
import { ImportGitHubModal } from '@/features/workspace/components/ImportGitHubModal';
import {
  extractGitHubRepoName,
  isValidGitHubRepoUrl,
} from '@/features/workspace/lib/githubImportValidation';
import { OverlayStackProvider } from '@/common/components/OverlayStack';
import { api, ApiError } from '@/common/api/api';

await import('@/common/components/ManagedModalShell');
await import('@/features/workspace/components/ManagedImportGitHubModal');

const FOLDER_HOME = '/Users/test/Documents/StashBase';

function wrapModal(onClose: () => void) {
  return h(OverlayStackProvider, null, h(ImportGitHubModal, { onClose }));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (nativeInputValueSetter) nativeInputValueSetter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function withApiStubs(
  run: () => Promise<void>,
  importRepository: typeof api.importPublicGitHubRepository = async () => {
    throw new Error('unexpected import');
  },
) {
  const originalHome = api.getFolderHome;
  const originalImport = api.importPublicGitHubRepository;
  api.getFolderHome = async () => ({ path: FOLDER_HOME });
  api.importPublicGitHubRepository = importRepository;
  try {
    await run();
  } finally {
    api.getFolderHome = originalHome;
    api.importPublicGitHubRepository = originalImport;
  }
}

test('GitHub URL helpers share the strict owner/repository contract', () => {
  assert.equal(extractGitHubRepoName('https://github.com/owner/my-repo'), 'my-repo');
  assert.equal(extractGitHubRepoName('https://github.com/owner/my-repo.git'), 'my-repo');
  assert.equal(extractGitHubRepoName('https://github.com/owner/my-repo/'), 'my-repo');
  assert.equal(extractGitHubRepoName('https://github.com/owner'), '');
  assert.equal(extractGitHubRepoName('https://gitlab.com/owner/repo'), '');

  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo'), true);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo.git'), true);
  assert.equal(isValidGitHubRepoUrl('http://github.com/owner/repo'), false);
  assert.equal(isValidGitHubRepoUrl('https://user:pass@github.com/owner/repo'), false);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo?ref=main'), false);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo/tree/main'), false);
  assert.equal(isValidGitHubRepoUrl('https://github.com/owner/repo%2Ftree'), false);
});

test('modal derives a valid name, focuses the URL, and shows the real folder-home destination', async () => {
  await withApiStubs(async () => {
    await withDom(async (dom) => {
      await mountApp(dom, wrapModal(() => {}), {
        state: appState({ workspace: { homeDir: '/Users/test' } }),
      });
      await dom.flush();

      const urlInput = dom.query('#github-import-url') as HTMLInputElement;
      const folderInput = dom.query('#github-import-folder-name') as HTMLInputElement;
      const submit = dom.queryAll('button').find((button) => button.textContent === 'Import and Open') as HTMLButtonElement;
      assert.equal(document.activeElement, urlInput);
      assert.equal(submit.disabled, true);

      await act(async () => {
        setInputValue(urlInput, 'https://github.com/Priyansh19077/CP-Templates');
      });
      assert.equal(folderInput.value, 'CP-Templates');
      assert.equal(submit.disabled, false);
      assert.match(document.body.textContent ?? '', /~\/Documents\/StashBase\/CP-Templates/);

      await act(async () => { setInputValue(folderInput, 'bad/name'); });
      assert.equal(submit.disabled, true);
      assert.equal(folderInput.getAttribute('aria-invalid'), 'true');
      assert.match(dom.query('[role="alert"]')?.textContent ?? '', /slashes/);
    });
  });
});

test('modal imports and opens through the workspace action before closing', async () => {
  let closed = false;
  const opened: string[] = [];
  await withApiStubs(async () => {
    await withDom(async (dom) => {
      await mountApp(dom, wrapModal(() => { closed = true; }), {
        state: appState({ workspace: { homeDir: '/Users/test' } }),
        actions: appActions({ openFolder: async (folder) => { opened.push(folder); } }),
      });
      await dom.flush();
      const urlInput = dom.query('#github-import-url') as HTMLInputElement;
      await act(async () => {
        setInputValue(urlInput, 'https://github.com/owner/repo');
      });
      const submit = dom.queryAll('button').find((button) => button.textContent === 'Import and Open')!;
      await dom.fire(submit, new MouseEvent('click', { bubbles: true }));
      assert.deepEqual(opened, [`${FOLDER_HOME}/repo`]);
      assert.equal(closed, true);
    });
  }, async (input) => {
    assert.deepEqual(input, { url: 'https://github.com/owner/repo', folderName: 'repo' });
    return { path: `${FOLDER_HOME}/repo` };
  });
});

test('clone errors remain inline with the entered values available for retry', async () => {
  await withApiStubs(async () => {
    await withDom(async (dom) => {
      await mountApp(dom, wrapModal(() => {}), {
        state: appState({ workspace: { homeDir: '/Users/test' } }),
      });
      await dom.flush();
      const urlInput = dom.query('#github-import-url') as HTMLInputElement;
      const folderInput = dom.query('#github-import-folder-name') as HTMLInputElement;
      await act(async () => { setInputValue(urlInput, 'https://github.com/owner/repo'); });
      const submit = dom.queryAll('button').find((button) => button.textContent === 'Import and Open')!;
      await dom.fire(submit, new MouseEvent('click', { bubbles: true }));
      assert.match(dom.query('[role="alert"]')?.textContent ?? '', /already exists/);
      assert.equal(urlInput.value, 'https://github.com/owner/repo');
      assert.equal(folderInput.value, 'repo');
    });
  }, async () => {
    throw new ApiError('A folder named "repo" already exists.', 409, 'DESTINATION_EXISTS');
  });
});

test('running import locks fields and Cancel aborts the request', async () => {
  let closed = false;
  let observedSignal: AbortSignal | undefined;
  await withApiStubs(async () => {
    await withDom(async (dom) => {
      await mountApp(dom, wrapModal(() => { closed = true; }), {
        state: appState({ workspace: { homeDir: '/Users/test' } }),
      });
      await dom.flush();
      const urlInput = dom.query('#github-import-url') as HTMLInputElement;
      const folderInput = dom.query('#github-import-folder-name') as HTMLInputElement;
      await act(async () => { setInputValue(urlInput, 'https://github.com/owner/repo'); });
      const submit = dom.queryAll('button').find((button) => button.textContent === 'Import and Open')!;
      await dom.fire(submit, new MouseEvent('click', { bubbles: true }));
      await dom.flush();
      assert.equal(urlInput.disabled, true);
      assert.equal(folderInput.disabled, true);
      assert.equal(dom.query('form')?.getAttribute('aria-busy'), 'true');
      assert.ok(dom.queryAll('button').some((button) => button.textContent === 'Importing…'));

      const cancel = dom.queryAll('button').find((button) => button.textContent === 'Cancel')!;
      await dom.fire(cancel, new MouseEvent('click', { bubbles: true }));
      assert.equal(observedSignal?.aborted, true);
      assert.equal(closed, true);
    });
  }, async (_input, options) => {
    observedSignal = options?.signal;
    return await new Promise((resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
  });
});

test('a published repository survives open failure and retries open without cloning again', async () => {
  let closed = false;
  let importCalls = 0;
  let openCalls = 0;
  const published = `${FOLDER_HOME}/repo`;
  await withApiStubs(async () => {
    await withDom(async (dom) => {
      await mountApp(dom, wrapModal(() => { closed = true; }), {
        state: appState({ workspace: { homeDir: '/Users/test' } }),
        actions: appActions({
          openFolder: async () => {
            openCalls += 1;
            if (openCalls === 1) throw new Error('index service unavailable');
          },
        }),
      });
      await dom.flush();
      const urlInput = dom.query('#github-import-url') as HTMLInputElement;
      await act(async () => { setInputValue(urlInput, 'https://github.com/owner/repo'); });
      const submit = dom.queryAll('button').find((button) => button.textContent === 'Import and Open')!;
      await dom.fire(submit, new MouseEvent('click', { bubbles: true }));
      assert.equal(closed, false);
      assert.match(dom.query('[role="alert"]')?.textContent ?? '', new RegExp(published));

      const retryOpen = dom.queryAll('button').find((button) => button.textContent === 'Open Imported Folder')!;
      await dom.fire(retryOpen, new MouseEvent('click', { bubbles: true }));
      assert.equal(closed, true);
      assert.equal(importCalls, 1);
      assert.equal(openCalls, 2);
    });
  }, async () => {
    importCalls += 1;
    return { path: published };
  });
});
