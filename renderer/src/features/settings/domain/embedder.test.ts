import { describe, expect, it } from 'vite-plus/test';

import { embedderState, keyedEmbedderState } from '@/test/fakes/settings';

import { activeEmbeddingSource, describeEmbedderSource, keyIsActive } from './embedder';

describe('embedder domain', () => {
  it('reports no active source until the server says the index is authorized', () => {
    expect(activeEmbeddingSource(embedderState())).toBeNull();
    expect(activeEmbeddingSource(embedderState({ authorized: true, source: 'openai' }))).toBe(
      'openai',
    );
  });

  it('counts only the reader’s own key as search by meaning being on', () => {
    expect(keyIsActive(embedderState())).toBe(false);
    expect(keyIsActive(keyedEmbedderState())).toBe(true);
    // A key stored but not answering is not on, and neither is a source the
    // renderer never offers, whatever the server resolved it to.
    expect(keyIsActive(embedderState({ hasKey: true }))).toBe(false);
    expect(keyIsActive(embedderState({ authorized: true, source: 'stashbase-account' }))).toBe(
      false,
    );
  });

  it('names the key that answers embeddings, or says search by meaning is not set up', () => {
    expect(describeEmbedderSource(embedderState())).toBe(
      'Searching by meaning isn’t set up. Add a key to turn it on. Keyword search keeps working.',
    );
    expect(
      describeEmbedderSource(keyedEmbedderState({ provider: 'openrouter', source: 'openrouter' })),
    ).toBe('Meaning-based search and indexing use your OpenRouter key.');
    expect(
      describeEmbedderSource(embedderState({ authorized: true, source: 'stashbase-account' })),
    ).toBe(
      'Searching by meaning isn’t set up. Add a key to turn it on. Keyword search keeps working.',
    );
  });
});
