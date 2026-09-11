import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import { useWorkspaceNotices } from './use-workspace-notices';

describe('useWorkspaceNotices', () => {
  it('says nothing when nothing needs saying', () => {
    const { result } = renderHook(() => useWorkspaceNotices(null, vi.fn(), null));
    expect(result.current).toEqual([]);
  });

  it('puts a refusal of what the reader tried ahead of a capability that could not answer', () => {
    const { result } = renderHook(() =>
      useWorkspaceNotices(
        { message: 'Preparation was refused.', tone: 'input' },
        vi.fn(),
        'The host lost this folder.',
      ),
    );
    expect(result.current.map((notice) => notice.tone)).toEqual(['input', 'capability']);
  });

  it('gives a refusal no action to take up, only an acknowledgement', () => {
    const dismiss = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceNotices({ message: 'Preparation was refused.', tone: 'input' }, dismiss, null),
    );
    expect(result.current[0]?.action).toBeNull();
    expect(result.current[0]?.dismissLabel).toBe('Dismiss');
    expect(result.current[0]?.onDismiss).toBe(dismiss);
  });

  it('never offers setup: a window with nothing wrong shows no invitation', () => {
    const { result } = renderHook(() => useWorkspaceNotices(null, vi.fn(), null));
    expect(result.current.some((notice) => notice.action !== null)).toBe(false);
  });
});
