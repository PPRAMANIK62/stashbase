import { describe, expect, it } from 'vite-plus/test';

import {
  mapWorkspaceFolderDialogResponse,
} from './workspace-folder-picker';

describe('workspace folder picker adapter', () => {
  it('maps selected, cancelled, and classified failure responses', () => {
    expect(mapWorkspaceFolderDialogResponse({ ok: true, folderPath: '/workspace/notes' })).toEqual({
      status: 'selected',
      folderPath: '/workspace/notes',
    });
    expect(mapWorkspaceFolderDialogResponse({ ok: true, folderPath: null })).toEqual({
      status: 'cancelled',
    });
    expect(
      mapWorkspaceFolderDialogResponse({
        ok: false,
        failure: { kind: 'unavailable', message: 'Folder picker unavailable.' },
      }),
    ).toEqual({
      status: 'failed',
      failure: { kind: 'unavailable', message: 'Folder picker unavailable.' },
    });
  });
});
