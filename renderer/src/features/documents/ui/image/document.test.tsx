import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { ImageDocument } from './document';

let getAnimationsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect() {}
      observe() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});

describe('image document', () => {
  it('uses compact viewer controls and opens the shared dialog lightbox', async () => {
    render(
      <ImageDocument
        name="diagram.png"
        resource={{ url: 'http://127.0.0.1/asset/diagram.png?v=1', version: 'v1' }}
      />,
    );
    const image = screen.getByRole('img', { name: 'diagram.png' });
    Object.defineProperties(image, {
      naturalHeight: { configurable: true, value: 800 },
      naturalWidth: { configurable: true, value: 1200 },
    });
    fireEvent.load(image);

    const toolbar = screen.getByRole('toolbar', { name: 'Image controls' });
    expect(toolbar.className).toContain('backdrop-blur-xl');
    expect(toolbar.parentElement?.className).toContain('top-3');
    expect(screen.getByRole('button', { name: 'Fit to view' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Zoom percentage' }));
    const zoomInput = screen.getByRole('textbox', { name: 'Zoom percentage' });
    fireEvent.change(zoomInput, { target: { value: '150' } });
    fireEvent.keyDown(zoomInput, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Zoom percentage' }).textContent).toBe('150%');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Enlarge image' }));
    expect(await screen.findByRole('dialog', { name: 'Image preview' })).not.toBeNull();
    expect(screen.getByRole('toolbar', { name: 'Image zoom controls' })).not.toBeNull();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
