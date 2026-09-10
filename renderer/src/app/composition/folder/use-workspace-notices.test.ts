import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import { useWorkspaceNotices } from './use-workspace-notices';

const OFFER = { decline: vi.fn(), setUp: vi.fn() };

describe('useWorkspaceNotices', () => {
  it('says nothing when nothing needs saying', () => {
    const { result } = renderHook(() => useWorkspaceNotices(null, vi.fn(), null, null));
    expect(result.current).toEqual([]);
  });

  it('carries the setup offer with something to take up and a decline', () => {
    const { result } = renderHook(() => useWorkspaceNotices(null, vi.fn(), null, OFFER));
    const [notice] = result.current;
    expect(notice?.tone).toBe('offer');
    expect(notice?.action?.label).toBe('Choose a source');
    expect(notice?.dismissLabel).toBe('Not now');
    expect(notice?.onDismiss).toBe(OFFER.decline);
  });

  it('puts a refusal of what the reader tried ahead of an offer they did not ask for', () => {
    const { result } = renderHook(() =>
      useWorkspaceNotices(
        { message: 'Preparation was refused.', tone: 'input' },
        vi.fn(),
        'The host lost this folder.',
        OFFER,
      ),
    );
    expect(result.current.map((notice) => notice.tone)).toEqual(['input', 'capability', 'offer']);
  });

  it('gives a refusal no action to take up, only an acknowledgement', () => {
    const { result } = renderHook(() =>
      useWorkspaceNotices(
        { message: 'Preparation was refused.', tone: 'input' },
        vi.fn(),
        null,
        null,
      ),
    );
    expect(result.current[0]?.action).toBeNull();
    expect(result.current[0]?.dismissLabel).toBe('Dismiss');
  });
});
