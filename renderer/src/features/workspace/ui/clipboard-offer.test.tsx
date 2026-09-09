import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/workspace/application/failure-messages';
import { FilesError, type ClipboardImageOffer } from '@/features/workspace/application/ports';
import { clipboardCapture, uploadApi as uploadApiFake } from '@/test/fakes/workspace';

import { ClipboardOffer } from './clipboard-offer';

const offer: ClipboardImageOffer = {
  bytes: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
  id: 'h1',
  name: 'clipboard-2026.png',
};

afterEach(cleanup);

describe('ClipboardOffer', () => {
  it('starts the watch on mount, offers an image, and imports it into the active folder', async () => {
    const capture = clipboardCapture();
    const upload = vi.fn(async () => ['clipboard-2026.png']);
    const onImported = vi.fn();
    render(
      <ClipboardOffer
        activeFolderPath="/library/research"
        capture={capture}
        onImported={onImported}
        upload={uploadApiFake({ upload })}
      />,
    );
    expect(capture.refresh).toHaveBeenCalledOnce();

    capture.emit(offer);
    expect(await screen.findByText('Add image to StashBase?')).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(onImported).toHaveBeenCalledWith({
        folderPath: '/library/research',
        path: 'clipboard-2026.png',
      }),
    );
    expect(upload).toHaveBeenCalledWith(
      '/library/research',
      [expect.objectContaining({ name: 'clipboard-2026.png' })],
      expect.any(AbortSignal),
    );
    expect(capture.settle).toHaveBeenCalledWith('h1');
  });

  it('reads a refused import on the files ladder and keeps the offer visible', async () => {
    const capture = clipboardCapture();
    const upload = uploadApiFake({
      upload: vi.fn(async () => {
        throw new FilesError('rejected', 'PNG payload rejected by the importer');
      }),
    });
    render(
      <ClipboardOffer activeFolderPath="/library/research" capture={capture} upload={upload} />,
    );
    capture.emit(offer);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      failureMessage('rejected'),
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(capture.settle).toHaveBeenCalledWith('h1');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('reports an unreachable server without repeating what it threw', async () => {
    const capture = clipboardCapture();
    const upload = uploadApiFake({
      upload: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    render(
      <ClipboardOffer activeFolderPath="/library/research" capture={capture} upload={upload} />,
    );
    capture.emit(offer);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      failureMessage('unavailable'),
    );
  });

  it('holds the offer until a folder is open and does nothing without a capture port', () => {
    const capture = clipboardCapture();
    const upload = uploadApiFake();
    const view = render(
      <ClipboardOffer activeFolderPath={null} capture={capture} upload={upload} />,
    );
    capture.emit(offer);
    expect(screen.queryByRole('dialog')).toBeNull();

    view.rerender(
      <ClipboardOffer activeFolderPath="/library/x" capture={capture} upload={upload} />,
    );
    expect(screen.queryByText('Add image to StashBase?')).not.toBeNull();

    cleanup();
    render(<ClipboardOffer activeFolderPath="/library/x" capture={null} upload={upload} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
