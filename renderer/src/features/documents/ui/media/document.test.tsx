import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';

import { MediaDocument } from './document';

const resource = {
  kind: 'media' as const,
  url: 'http://127.0.0.1/asset/movie.mp4?v=one',
  version: 'one',
};
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('plays the original video and releases it when hidden or unmounted', () => {
  const props = { name: 'movie.mp4', path: 'movie.mp4', resource };
  const view = render(<MediaDocument {...props} active />);
  const player = screen.getByLabelText('movie.mp4 playback');
  expect(player.tagName).toBe('VIDEO');
  expect(player.getAttribute('src')).toBe(resource.url);
  view.rerender(<MediaDocument {...props} active={false} />);
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  view.unmount();
  expect(player.hasAttribute('src')).toBe(false);
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
});

it('shows an unavailable preview when the source codec cannot play', () => {
  render(<MediaDocument active name="movie.mp4" path="movie.mp4" resource={resource} />);
  fireEvent.error(screen.getByLabelText('movie.mp4 playback'));
  expect(screen.getByRole('status').textContent).toContain('external application');
  expect(screen.queryByLabelText('movie.mp4 playback')).toBeNull();
});

it('uses an audio player for audio sources', () => {
  render(<MediaDocument active name="voice.wav" path="voice.wav" resource={resource} />);
  expect(screen.getByLabelText('voice.wav playback').tagName).toBe('AUDIO');
});
