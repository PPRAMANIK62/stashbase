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
  return { activeFolder: null, initialFolder: pending, ...overrides };
}

describe('folder landing precedence', () => {
  it('waits for the desktop before landing anywhere', () => {
    // While the claim is outstanding there is no path to open and no welcome
    // screen to show, so nothing can start and win.
    const landing = chooseFolderLanding(sources());
    expect(landing).toEqual({ source: 'pending' });
    expect(landingToOpen(landing)).toBeNull();
  });

  it('opens the folder the window was created for', () => {
    const landing = chooseFolderLanding(sources({ initialFolder: settled(NOTES) }));
    expect(landing).toEqual({ source: 'initial', path: NOTES });
    expect(landingToOpen(landing)).toBe(NOTES);
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
      sources({ activeFolder: WRITING, initialFolder: settled(NOTES) }),
    );
    expect(movedOn).toEqual({ source: 'server', path: WRITING });
    expect(landingToOpen(movedOn)).toBeNull();
  });

  it('lands on the welcome screen for a window nobody named a folder for', () => {
    // A relaunch and a new window both arrive here. The saved session is not
    // among the sources at all, so there is no row for it to win through.
    const landing = chooseFolderLanding(sources({ initialFolder: settled(null) }));
    expect(landing).toEqual({ source: 'none' });
    expect(landingToOpen(landing)).toBeNull();
    expect(Object.keys(sources()).toSorted()).toEqual(['activeFolder', 'initialFolder']);
  });
});
