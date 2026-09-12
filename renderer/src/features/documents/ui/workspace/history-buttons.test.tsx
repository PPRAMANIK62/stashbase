import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createDocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { documentQueryScope, sourceApi } from '@/test/fakes/documents';

import { DocumentHistoryButtons } from './history-buttons';

const runtimes: ReturnType<typeof createDocumentTabsRuntime>[] = [];

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

function createRuntime() {
  let next = 0;
  const runtime = createDocumentTabsRuntime({
    api: sourceApi(),
    createId: () => `tab-${++next}`,
    createQueries: () => documentQueryScope(),
    folderPath: '/library/notes',
    generation: 1,
  });
  runtimes.push(runtime);
  return runtime;
}

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

describe('DocumentHistoryButtons', () => {
  it('waits disabled with nothing visited and names the file each step would reach', async () => {
    const runtime = createRuntime();
    render(<DocumentHistoryButtons runtime={runtime} />);
    expect(button('Back').disabled).toBe(true);
    expect(button('Forward').disabled).toBe(true);

    await act(async () => {
      await runtime.open({ folderPath: '/library/notes', path: 'one.md' });
      await runtime.open(
        { folderPath: '/library/notes', path: 'drafts/two.md' },
        { preview: true },
      );
    });
    expect(button('Back to one.md').disabled).toBe(false);
    expect(button('Forward').disabled).toBe(true);

    await userEvent.setup().click(button('Back to one.md'));
    await waitFor(() => expect(runtime.activeSource()?.path).toBe('one.md'));
    expect(await screen.findByRole('button', { name: 'Forward to two.md' })).not.toBeNull();
    expect(button('Back').disabled).toBe(true);
  });
});
