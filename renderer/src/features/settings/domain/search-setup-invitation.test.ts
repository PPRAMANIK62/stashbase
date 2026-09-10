import { describe, expect, it } from 'vite-plus/test';

import { searchSetupInvitation } from './search-setup-invitation';

const BASE = {
  answeredVersion: null,
  configured: false,
  currentVersion: 1,
  folderActive: true,
  loaded: true,
} as const;

describe('search setup invitation', () => {
  it('offers once a folder is active and nothing has been answered', () => {
    expect(searchSetupInvitation(BASE)).toEqual({ kind: 'offer', version: 1 });
  });

  it('holds until the stored answer is known, so a decline is never replayed', () => {
    expect(searchSetupInvitation({ ...BASE, loaded: false })).toEqual({ kind: 'unknown' });
  });

  it('holds until the folder readiness answers, so it never flashes and withdraws', () => {
    expect(searchSetupInvitation({ ...BASE, configured: null })).toEqual({ kind: 'unknown' });
  });

  it('never opens in a bare Library window', () => {
    expect(searchSetupInvitation({ ...BASE, folderActive: false })).toEqual({ kind: 'no-folder' });
  });

  it('stays answered for every later folder and relaunch', () => {
    expect(searchSetupInvitation({ ...BASE, answeredVersion: 1 })).toEqual({ kind: 'answered' });
  });

  it('has nothing to invite once a source is configured', () => {
    expect(searchSetupInvitation({ ...BASE, configured: true })).toEqual({
      kind: 'already-set-up',
    });
  });

  it('re-offers a raised revision to someone who answered an older one', () => {
    expect(searchSetupInvitation({ ...BASE, answeredVersion: 1, currentVersion: 2 })).toEqual({
      kind: 'offer',
      version: 2,
    });
  });

  it('prefers a configured source over a stale unanswered revision', () => {
    expect(
      searchSetupInvitation({ ...BASE, answeredVersion: 1, configured: true, currentVersion: 2 }),
    ).toEqual({ kind: 'already-set-up' });
  });
});
