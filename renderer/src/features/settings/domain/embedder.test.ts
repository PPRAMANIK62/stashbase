import { describe, expect, it } from 'vite-plus/test';

import { embedderState, SIGNED_IN_ACCOUNT, SIGNED_OUT_ACCOUNT } from '@/test/fakes/settings';

import {
  activeEmbeddingSource,
  describeEmbedderSource,
  describeQuota,
  quotaRemainingPercent,
  type HostedQuota,
} from './embedder';

const quota: HostedQuota = {
  grantedTokens: 1000,
  periodEndsAt: '2026-10-01T00:00:00.000Z',
  periodStartedAt: '2026-09-01T00:00:00.000Z',
  plan: 'free',
  remainingTokens: 250,
  reservedTokens: 0,
  usedTokens: 750,
};

describe('embedder domain', () => {
  it('reports no active source until the server says the index is authorized', () => {
    expect(activeEmbeddingSource(embedderState())).toBeNull();
    expect(activeEmbeddingSource(embedderState({ authorized: true, source: 'openai' }))).toBe(
      'openai',
    );
  });

  it('names the source that answers embeddings, or says the index is not set up', () => {
    expect(describeEmbedderSource(embedderState())).toBe(
      'AI Index is not set up. Sign in or add a key. Exact search keeps working.',
    );
    expect(
      describeEmbedderSource(embedderState({ authorized: true, source: 'stashbase-account' })),
    ).toBe('Meaning-based search and indexing use your StashBase account.');
    expect(
      describeEmbedderSource(
        embedderState({ authorized: true, provider: 'openrouter', source: 'openrouter' }),
      ),
    ).toBe('Meaning-based search and indexing use your OpenRouter key.');
  });

  it('reads the remaining share of a granted quota, and never divides by zero', () => {
    expect(quotaRemainingPercent(SIGNED_IN_ACCOUNT)).toBe(25);
    expect(quotaRemainingPercent(SIGNED_OUT_ACCOUNT)).toBe(0);
    expect(
      quotaRemainingPercent({
        ...SIGNED_IN_ACCOUNT,
        quota: { ...quota, grantedTokens: 0 },
      }),
    ).toBe(0);
  });

  it('tells an unreported quota apart from an unavailable one', () => {
    expect(describeQuota(SIGNED_OUT_ACCOUNT)).toBe('Usage not reported yet.');
    expect(describeQuota({ ...SIGNED_IN_ACCOUNT, quotaUnavailable: true })).toBe(
      'Usage is temporarily unavailable.',
    );
    expect(describeQuota(SIGNED_IN_ACCOUNT)).toMatch(/^25% remaining · 250 tokens left · Resets /u);
  });

  it('omits the reset date when the period has no end', () => {
    expect(describeQuota({ ...SIGNED_IN_ACCOUNT, quota: { ...quota, periodEndsAt: null } })).toBe(
      '25% remaining · 250 tokens left',
    );
  });
});
