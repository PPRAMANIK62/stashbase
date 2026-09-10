import { describe, expect, it } from 'vite-plus/test';

import { mapFolderSelection } from './folder-picker';

describe('library folder picker adapter', () => {
  it('maps selected, cancelled, and classified failure responses', () => {
    expect(mapFolderSelection({ ok: true, folderPath: '/library/notes' })).toEqual({
      status: 'selected',
      folderPath: '/library/notes',
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
