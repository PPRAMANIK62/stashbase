import { describe, expect, it } from 'vite-plus/test';

import {
  createDocumentHistoryState,
  MAX_DOCUMENT_HISTORY,
  nextDocumentVisit,
  previousDocumentVisit,
  recordDocumentVisit,
  stepDocumentHistoryBack,
  stepDocumentHistoryForward,
  type DocumentHistoryState,
} from './history';

const source = (path: string) => ({ folderPath: '/library/notes', path });
const paths = (state: DocumentHistoryState) => state.entries.map((entry) => entry.source.path);

describe('document history', () => {
  it('records visits in order and steps the cursor between them', () => {
    let state = createDocumentHistoryState();
    expect(previousDocumentVisit(state)).toBeNull();
    expect(nextDocumentVisit(state)).toBeNull();
    expect(stepDocumentHistoryBack(state)).toBe(state);

    state = recordDocumentVisit(state, { source: source('one.md') });
    state = recordDocumentVisit(state, {
      source: source('two.md'),
      anchor: 'details',
    });
    state = recordDocumentVisit(state, { source: source('three.md') });
    expect(paths(state)).toEqual(['one.md', 'two.md', 'three.md']);
    expect(state.index).toBe(2);

    state = stepDocumentHistoryBack(state);
    expect(state.index).toBe(1);
    expect(previousDocumentVisit(state)?.source.path).toBe('one.md');
    // The place the visit landed on comes back with it.
    expect(nextDocumentVisit(stepDocumentHistoryBack(state))).toEqual({
      anchor: 'details',
      source: source('two.md'),
    });
    state = stepDocumentHistoryForward(stepDocumentHistoryForward(state));
    expect(state.index).toBe(2);
    expect(stepDocumentHistoryForward(state)).toBe(state);
  });

  it('folds a visit to the current source into its entry and cuts off what lay ahead', () => {
    let state = createDocumentHistoryState();
    state = recordDocumentVisit(state, { source: source('one.md') });
    state = recordDocumentVisit(state, { source: source('two.md') });
    state = recordDocumentVisit(state, { source: source('three.md') });

    // Re-visiting the source in front of the reader is not a new entry, but
    // a new place in it is remembered.
    const same = recordDocumentVisit(state, { source: source('three.md') });
    expect(same).toBe(state);
    const moved = recordDocumentVisit(state, {
      source: source('three.md'),
      anchor: 'end',
    });
    expect(paths(moved)).toEqual(['one.md', 'two.md', 'three.md']);
    expect(moved.entries[2]?.anchor).toBe('end');

    // Stepping back and visiting somewhere new drops the forward entries.
    state = stepDocumentHistoryBack(stepDocumentHistoryBack(moved));
    state = recordDocumentVisit(state, { source: source('four.md') });
    expect(paths(state)).toEqual(['one.md', 'four.md']);
    expect(state.index).toBe(1);
    expect(nextDocumentVisit(state)).toBeNull();
  });

  it('lets the oldest visits fall off past the bound', () => {
    let state = createDocumentHistoryState();
    for (let index = 0; index < MAX_DOCUMENT_HISTORY + 5; index += 1) {
      state = recordDocumentVisit(state, { source: source(`${index}.md`) });
    }
    expect(state.entries).toHaveLength(MAX_DOCUMENT_HISTORY);
    expect(state.entries[0]?.source.path).toBe('5.md');
    expect(state.index).toBe(MAX_DOCUMENT_HISTORY - 1);
  });
});
