import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { App } from '@/app';
import { AppProviders } from '@/app/composition/app-providers';

describe('workspace shell', () => {
  let container: HTMLDivElement;
  let root: Root;
  let getAnimationsDescriptor: PropertyDescriptor | undefined;

  beforeEach(async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
    getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: vi.fn(() => []),
    });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <AppProviders>
          <App />
        </AppProviders>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (getAnimationsDescriptor) {
      Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
    } else {
      Reflect.deleteProperty(Element.prototype, 'getAnimations');
    }
    vi.unstubAllGlobals();
  });

  it('starts with only the Files sidebar and Agent workspace', () => {
    const sidebar = container.querySelector('[data-slot="sidebar"]');

    expect(container.querySelectorAll('[data-slot="sidebar"]')).toHaveLength(1);
    expect(sidebar?.getAttribute('data-variant')).toBe('inset');
    expect(container.querySelector('[aria-label="Agent workspace"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Document');
  });

  it('collapses the Files sidebar from the titlebar control', async () => {
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    const toggle = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle files sidebar"]',
    );

    expect(sidebar?.getAttribute('data-state')).toBe('expanded');
    expect(toggle).not.toBeNull();

    await act(async () => toggle?.click());

    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
  });

  it('keeps the expand control clear of a floating sidebar', async () => {
    const toggle = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle files sidebar"]',
    );

    await act(async () => toggle?.click());
    await act(async () => {
      toggle?.dispatchEvent(
        new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    });

    expect(container.querySelector('[data-sidebar="peek"]')).toBeNull();
  });
});
