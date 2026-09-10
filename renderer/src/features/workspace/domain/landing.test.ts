import { describe, expect, it } from 'vite-plus/test';

import {
  chooseFolderLanding,
  landingToOpen,
  type FolderLandingSources,
  type InitialFolderClaim,
} from './landing';

const NOTES = '/library/notes';
const WRITING = '/library/writing';

const pending: InitialFolderClaim = { kind: 'pending' };
const settled = (folderPath: string | null): InitialFolderClaim => ({
  kind: 'settled',
  folderPath,
});

function sources(overrides: Partial<FolderLandingSources> = {}): FolderLandingSources {
  return { activeFolder: null, initialFolder: pending, sessionFolder: null, ...overrides };
}

describe('folder landing precedence', () => {
  it('waits for the desktop rather than opening the saved session first', () => {
    // The whole defect, asserted as a value: while the claim is outstanding
    // there is no path to open, so the restore cannot start and win.
    const landing = chooseFolderLanding(sources({ sessionFolder: WRITING }));
    expect(landing).toEqual({ source: 'pending' });
    expect(landingToOpen(landing)).toBeNull();
  });

  it('opens the folder the window was created for over the saved session', () => {
    const landing = chooseFolderLanding(
      sources({ initialFolder: settled(NOTES), sessionFolder: WRITING }),
    );
    expect(landing).toEqual({ source: 'initial', path: NOTES });
    expect(landingToOpen(landing)).toBe(NOTES);
  });

  it('restores the saved session for a window nobody named a folder for', () => {
    const landing = chooseFolderLanding(
      sources({ initialFolder: settled(null), sessionFolder: WRITING }),
    );
    expect(landing).toEqual({ source: 'session', path: WRITING });
    expect(landingToOpen(landing)).toBe(WRITING);
  });

  it('keeps the folder the server already holds, whatever else names one', () => {
    // A window that has landed needs no second opinion, so it neither waits on
    // an outstanding claim nor reopens a spent one. This is what stops a
    // claimed folder dragging a reader back after they have moved on.
    expect(chooseFolderLanding(sources({ activeFolder: NOTES }))).toEqual({
      source: 'server',
      path: NOTES,
    });
    const movedOn = chooseFolderLanding(
      sources({ activeFolder: WRITING, initialFolder: settled(NOTES), sessionFolder: NOTES }),
    );
    expect(movedOn).toEqual({ source: 'server', path: WRITING });
    expect(landingToOpen(movedOn)).toBeNull();
  });

  it('lands nowhere when no source names a folder', () => {
    const landing = chooseFolderLanding(sources({ initialFolder: settled(null) }));
    expect(landing).toEqual({ source: 'none' });
    expect(landingToOpen(landing)).toBeNull();
  });
});
