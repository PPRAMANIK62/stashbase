import { describe, expect, it, vi } from 'vite-plus/test';

import { startMarkdownEditorCreation } from './markdown-editor-lifecycle';

describe('Markdown editor lifecycle', () => {
  it('does not destroy a rejected OnCreate editor and destroys a created retry once', async () => {
    const failedDestroy = vi.fn(async () => undefined);
    const failed = {
      create: vi.fn(async () => {
        throw new Error('create rejected');
      }),
      destroy: failedDestroy,
      editor: { status: 'OnCreate' },
    };
    const failure = vi.fn();
    const stopFailed = startMarkdownEditorCreation(failed, { failed: failure, ready: vi.fn() });
    await Promise.resolve();
    await Promise.resolve();
    stopFailed();

    const retryDestroy = vi.fn(async () => undefined);
    const retry = {
      create: vi.fn(async () => {
        retry.editor.status = 'Created';
      }),
      destroy: retryDestroy,
      editor: { status: 'OnCreate' },
    };
    const ready = vi.fn();
    const stopRetry = startMarkdownEditorCreation(retry, { failed: vi.fn(), ready });
    await Promise.resolve();
    stopRetry();
    stopRetry();

    expect(failure).toHaveBeenCalledOnce();
    expect(failedDestroy).not.toHaveBeenCalled();
    expect(ready).toHaveBeenCalledWith(retry);
    expect(retryDestroy).toHaveBeenCalledOnce();
  });
});
