import { describe, expect, it } from 'vite-plus/test';

import { mapFolderSelection } from './folder-picker';

describe('project folder picker adapter', () => {
  it('maps selected, cancelled, and classified failure responses', () => {
    expect(mapFolderSelection({ ok: true, folderPath: '/project/notes' })).toEqual({
      status: 'selected',
      folderPath: '/project/notes',
    });
    expect(mapFolderSelection({ ok: true, folderPath: null })).toEqual({
      status: 'cancelled',
    });
    expect(
      mapFolderSelection({
        ok: false,
        failure: { kind: 'unavailable', message: 'Folder picker unavailable.' },
      }),
    ).toEqual({
      status: 'failed',
      failure: { kind: 'unavailable', message: 'Folder picker unavailable.' },
    });
  });
});
