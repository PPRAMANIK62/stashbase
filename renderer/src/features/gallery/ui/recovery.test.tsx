import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';

import { FluidProviders as Providers } from '@/shared/runtime/fluid-providers';
import { writeToClipboard } from '@/shared/ui/clipboard';

import { GalleryPrompt } from './prompt';
import { GalleryScreenshots } from './screenshots';

vi.mock('@/shared/ui/clipboard', () => ({ writeToClipboard: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('keeps the prompt readable after clipboard refusal and lets the reader retry', async () => {
  vi.mocked(writeToClipboard)
    .mockRejectedValueOnce(new Error('refused'))
    .mockResolvedValue(undefined);
  render(
    <Providers>
      <GalleryPrompt prompt="Draft an outline." />
    </Providers>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Prompt' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
  expect(await screen.findByRole('status')).toHaveProperty(
    'textContent',
    expect.stringContaining('Could not copy'),
  );
  expect(screen.getByText('Draft an outline.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
  await screen.findByRole('button', { name: 'Copied' });
  expect(screen.queryByRole('status')).toBeNull();
  expect(writeToClipboard).toHaveBeenLastCalledWith('Draft an outline.');
});

it('does not show a previous prompt clipboard confirmation on a replacement prompt', async () => {
  let finish!: () => void;
  vi.mocked(writeToClipboard).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(
    <Providers>
      <GalleryPrompt key="old" prompt="Old prompt" />
    </Providers>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Prompt' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
  view.rerender(
    <Providers>
      <GalleryPrompt key="new" prompt="New prompt" />
    </Providers>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Prompt' }));
  await act(async () => finish());
  expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeTruthy();
});

it('retries a failed screenshot through the same proxy and can select another screenshot', async () => {
  const first =
    'http://localhost:9000/api/gallery/image?src=https%3A%2F%2Fassets.stashbase.ai%2Fa.png';
  const second =
    'http://localhost:9000/api/gallery/image?src=https%3A%2F%2Fassets.stashbase.ai%2Fb.png';
  render(
    <Providers>
      <GalleryScreenshots name="Example" screenshots={[first, second]} />
    </Providers>,
  );
  fireEvent.error(screen.getByRole('img', { name: 'Example screenshot 1' }));
  expect(screen.getByText('Could not load this screenshot.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry screenshot' }));
  const retried = screen.getByRole('img', { name: 'Example screenshot 1' }).getAttribute('src');
  const url = new URL(retried ?? '');
  expect(url.origin + url.pathname).toBe('http://localhost:9000/api/gallery/image');
  expect(url.searchParams.get('src')).toBe('https://assets.stashbase.ai/a.png');
  expect(retried).not.toBe(first);
  fireEvent.load(screen.getByRole('img', { name: 'Example screenshot 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Screenshot 2' }));
  await waitFor(() =>
    expect(screen.getByRole('img', { name: 'Example screenshot 2' }).getAttribute('src')).toBe(
      second,
    ),
  );
});
