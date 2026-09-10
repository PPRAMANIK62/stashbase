import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import type { AppearancePort } from '@/features/settings/public';
import type { AppearanceSurface } from '@/shared/domain/appearance';
import { appearancePort } from '@/test/fakes/settings';

import { useAppearanceSurface } from './use-appearance-surface';

const opened: BroadcastChannel[] = [];

/** A change another window published. It has to come from a second channel,
 *  because a `BroadcastChannel` never delivers to the instance that posted. */
function post(surface: AppearanceSurface): void {
  const channel = new BroadcastChannel('stashbase-appearance');
  opened.push(channel);
  channel.postMessage(surface);
}

const root = () => document.documentElement;

afterEach(() => {
  cleanup();
  for (const channel of opened.splice(0)) channel.close();
  root().classList.remove('light', 'dark');
  delete root().dataset.uiScale;
  delete root().dataset.readingTextSize;
});

describe('useAppearanceSurface', () => {
  it('applies what the read answered', async () => {
    const port = appearancePort({
      load: async () => ({ readingTextSize: 'large', theme: 'dark', uiScale: 'small' }),
    });
    renderHook(() => useAppearanceSurface(port));

    await waitFor(() => expect(root().classList.contains('dark')).toBe(true));
    expect(root().dataset.uiScale).toBe('small');
    expect(root().dataset.readingTextSize).toBe('large');
  });

  it('lets a broadcast mid-read stand against the late answer', async () => {
    let answer: ((preferences: Awaited<ReturnType<AppearancePort['load']>>) => void) | null = null;
    const port = appearancePort({
      load: () => new Promise((resolve) => (answer = resolve)),
    });
    renderHook(() => useAppearanceSurface(port));
    await waitFor(() => expect(answer).not.toBeNull());

    const chosen: AppearanceSurface = {
      themeClass: 'dark',
      uiScale: 'large',
      readingTextSize: 'large',
    };
    post(chosen);
    await waitFor(() => expect(root().classList.contains('dark')).toBe(true));

    await act(async () => {
      answer?.({ readingTextSize: 'small', theme: 'light', uiScale: 'small' });
    });

    expect(root().classList.contains('dark')).toBe(true);
    expect(root().classList.contains('light')).toBe(false);
    expect(root().dataset.uiScale).toBe('large');
    expect(root().dataset.readingTextSize).toBe('large');
  });
});
