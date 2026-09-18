import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import { useWorkspaceNotices } from './use-workspace-notices';

function notices(
  overrides: Partial<Parameters<typeof useWorkspaceNotices>[0]> = {},
): Parameters<typeof useWorkspaceNotices>[0] {
  return {
    dismissPreparationFailure: vi.fn(),
    dismissRevisionFailure: vi.fn(),
    hostFailure: null,
    preparationFailure: null,
    revisionFailures: [],
    ...overrides,
  };
}

describe('useWorkspaceNotices', () => {
  it('says nothing when nothing needs saying', () => {
    const { result } = renderHook(() => useWorkspaceNotices(notices()));
    expect(result.current).toEqual([]);
  });

  it('puts a refusal of what the reader tried ahead of a capability that could not answer', () => {
    const { result } = renderHook(() =>
      useWorkspaceNotices(
        notices({
          hostFailure: 'The host lost this folder.',
          preparationFailure: { message: 'Preparation was refused.', tone: 'input' },
        }),
      ),
    );
    expect(result.current.map((notice) => notice.tone)).toEqual(['input', 'capability']);
  });

  it('gives a refusal no action to take up, only an acknowledgement', () => {
    const dismiss = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceNotices(
        notices({
          dismissPreparationFailure: dismiss,
          preparationFailure: { message: 'Preparation was refused.', tone: 'input' },
        }),
      ),
    );
    expect(result.current[0]?.action).toBeNull();
    expect(result.current[0]?.dismissLabel).toBe('Dismiss');
    expect(result.current[0]?.onDismiss).toBe(dismiss);
  });

  it('never offers setup: a window with nothing wrong shows no invitation', () => {
    const { result } = renderHook(() => useWorkspaceNotices(notices()));
    expect(result.current.some((notice) => notice.action !== null)).toBe(false);
  });

  it('says every parked revision it could not show, and dismisses one by its sentence', () => {
    const dismissRevisionFailure = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceNotices(
        notices({
          dismissRevisionFailure,
          revisionFailures: ['plan.md did not open.', 'notes.md has a review open.'],
        }),
      ),
    );

    expect(result.current.map((notice) => notice.message)).toEqual([
      'plan.md did not open.',
      'notes.md has a review open.',
    ]);
    expect(result.current.every((notice) => notice.tone === 'capability')).toBe(true);
    result.current[1]?.onDismiss?.();
    expect(dismissRevisionFailure).toHaveBeenCalledWith('notes.md has a review open.');
  });
});
