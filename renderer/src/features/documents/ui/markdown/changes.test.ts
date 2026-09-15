import { CrepeBuilder } from '@milkdown/crepe/builder';
import { editorViewCtx } from '@milkdown/kit/core';
import { expect, it, vi } from 'vite-plus/test';

import { watchMarkdownChanges } from './changes';

it('publishes the latest Markdown synchronously before an immediate editor disposal', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const editor = new CrepeBuilder({ root: host, defaultValue: 'Before' });
  const report = vi.fn();
  watchMarkdownChanges(editor, report);
  try {
    await editor.create();
    editor.editor.action((context) => {
      const view = context.get(editorViewCtx);
      view.dispatch(view.state.tr.insertText('After', 1, 7));
    });
    expect(report).toHaveBeenLastCalledWith('After\n');
  } finally {
    await editor.destroy();
    host.remove();
  }
});
