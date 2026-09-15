import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';

import { Providers } from '@/app/providers';
import type { GalleryEntry, GalleryPort } from '@/features/gallery/public';

import { useGalleryShop } from './use-gallery-shop';

afterEach(cleanup);

function Shop({ port, copy }: { port: GalleryPort; copy: (entry: GalleryEntry) => void }) {
  const shop = useGalleryShop(port, copy, false, null);
  return (
    <>
      {shop.band}
      <button onClick={shop.browse}>Browse Gallery</button>
      {shop.surfaces}
    </>
  );
}

it('uses the refreshed entry for an already-open detail and copy action', async () => {
  let publish!: (entries: readonly GalleryEntry[]) => void;
  const response = new Promise<readonly GalleryEntry[]>((resolve) => {
    publish = resolve;
  });
  const copy = vi.fn();
  render(
    <Providers>
      <Shop port={{ loadIndex: () => response }} copy={copy} />
    </Providers>,
  );
  fireEvent.click(screen.getByRole('button', { name: /How to Start a Startup/ }));
  const updated: GalleryEntry = {
    id: 'how-to-start-a-startup',
    name: 'Updated project',
    repo: 'https://github.com/owner/new',
    category: 'course',
    description: 'Updated description',
    contents: '',
    about: null,
    files: null,
    learnMore: null,
    screenshots: null,
    starterPrompts: [],
    wikiPrompt: null,
  };
  await act(async () => publish([updated]));
  const detail = screen.getByRole('dialog', { name: 'Gallery' });
  await waitFor(() =>
    expect(within(detail).getByRole('heading', { name: 'Updated project' })).toBeTruthy(),
  );
  fireEvent.click(within(detail).getByRole('button', { name: 'Make a copy' }));
  expect(copy).toHaveBeenCalledWith(expect.objectContaining({ repo: updated.repo }));
});

it('retries an unavailable catalog when the shop is reopened', async () => {
  const loadIndex = vi.fn().mockResolvedValueOnce(null).mockResolvedValue([]);
  render(
    <Providers>
      <Shop port={{ loadIndex }} copy={vi.fn()} />
    </Providers>,
  );
  await screen.findByText(/The latest Gallery is unavailable/);
  fireEvent.click(screen.getByRole('button', { name: 'Browse Gallery' }));
  await waitFor(() => expect(loadIndex).toHaveBeenCalledTimes(2));
});

it('removes the copy action when publication withdraws the selected project', async () => {
  let publish!: (entries: readonly GalleryEntry[]) => void;
  const response = new Promise<readonly GalleryEntry[]>((resolve) => {
    publish = resolve;
  });
  render(
    <Providers>
      <Shop port={{ loadIndex: () => response }} copy={vi.fn()} />
    </Providers>,
  );
  fireEvent.click(screen.getByRole('button', { name: /How to Start a Startup/ }));
  await act(async () => publish([]));
  await screen.findByText(/This project is no longer in the Gallery/);
  expect(screen.queryByRole('button', { name: 'Make a copy' })).toBeNull();
});
