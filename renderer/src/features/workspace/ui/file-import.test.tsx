import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vite-plus/test';

import type { UploadPort, UploadResult } from '@/features/workspace/application/ports';
import { createWorkspaceRuntime } from '@/features/workspace/application/runtime';
import { filesApi, listing, listingFile, workspaceRuntimeOptions } from '@/test/fakes/workspace';
import { withQueryClient } from '@/test/query';

import { FileImport } from './file-import';
import { FileTree } from './file-tree';

afterEach(cleanup);

it('offers import in the tree menu and shows progress only while importing', async () => {
  const runtime = createWorkspaceRuntime(workspaceRuntimeOptions());
  let finish!: (result: UploadResult) => void;
  const upload = vi.fn<UploadPort['upload']>(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { client } = withQueryClient(
    <FileImport api={{ upload }} runtime={runtime}>
      {(importFiles) => (
        <FileTree
          api={filesApi({
            load: vi.fn(async () => listing([listingFile({ path: 'existing.md' })])),
          })}
          importFiles={importFiles}
          revealLabel="Show in file manager"
          runtime={runtime}
        />
      )}
    </FileImport>,
  );
  await screen.findByRole('treeitem', { name: 'existing.md' });
  expect(screen.queryByText('Import files…')).toBeNull();
  expect(screen.queryByText('Importing…')).toBeNull();

  const user = userEvent.setup();
  const input = screen.getByLabelText('Choose files to import');
  const choose = vi.spyOn(input, 'click');
  fireEvent.contextMenu(screen.getByRole('tree', { name: 'Files' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Import files…' }));
  expect(choose).toHaveBeenCalledOnce();
  const file = new File(['draft'], 'draft.md');
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByText('Importing…')).not.toBeNull();
  expect(upload).toHaveBeenCalledWith(
    runtime.scope.folder.path,
    [{ blob: file, name: 'draft.md' }],
    runtime.signal,
  );
  await act(async () => finish({ paths: ['draft.md'], refused: [] }));
  expect(await screen.findByText('1 file imported.')).not.toBeNull();
  expect(screen.queryByText('Importing…')).toBeNull();
  runtime.dispose();
  client.clear();
});
